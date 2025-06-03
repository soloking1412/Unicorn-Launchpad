import { AnchorProvider } from '@project-serum/anchor';
import { PublicKey, SystemProgram, TransactionInstruction, Keypair, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createInitializeMintInstruction, MINT_SIZE, createAssociatedTokenAccountInstruction, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Project account size
const PROJECT_ACCOUNT_SIZE = 32 + // authority
  32 + // name
  8 + // symbol
  8 + // funding_goal
  8 + // total_raised
  8 + // token_price
  1 + // is_active
  1 + // bump
  32; // token_mint

// Temporary interface until we generate the IDL
interface Project {
  authority: PublicKey;
  name: string;
  symbol: string;
  fundingGoal: number;
  totalRaised: number;
  tokenPrice: number;
  isActive: boolean;
  tokenMintAddress: PublicKey;
}

export class UnicornFactoryClient {
  private provider: AnchorProvider;
  public programId: PublicKey;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.programId = new PublicKey('E95C9BgCrrt6Sy8MUbBPTVEEQJSR5Hyau2gAiuAdhb6Y');
  }

  async initializeProject(
    name: string,
    symbol: string,
    fundingGoal: number
  ): Promise<string> {
    console.log('Starting project initialization...');
    console.log('Provider wallet:', this.provider.wallet.publicKey.toString());
    
    // Generate a new keypair for the token mint
    const tokenMint = Keypair.generate();
    console.log('Generated token mint:', tokenMint.publicKey.toString());
    
    // Find PDA and bump
    const [projectPda, bump] = await PublicKey.findProgramAddress(
      [Buffer.from('project'), this.provider.wallet.publicKey.toBuffer()],
      this.programId
    );
    console.log('Generated PDA:', projectPda.toString());
    console.log('Bump:', bump);
  
    // Check if account already exists
    const existingAccount = await this.provider.connection.getAccountInfo(projectPda);
    if (existingAccount) {
      throw new Error(`Project account already exists at ${projectPda.toString()}. Use a different wallet or add a unique identifier to the seeds.`);
    }
  
    // Convert name and symbol to UTF-8 bytes
    const nameBytes = new TextEncoder().encode(name);
    const symbolBytes = new TextEncoder().encode(symbol);
    console.log('Encoded data:', {
      nameLength: nameBytes.length,
      symbolLength: symbolBytes.length,
      fundingGoal
    });
  
    // Create instruction data buffer
    const data = Buffer.alloc(8 + nameBytes.length + symbolBytes.length + 8);
    let offset = 0;
  
    // Write name length (u32)
    data.writeUInt32LE(nameBytes.length, offset);
    offset += 4;
  
    // Write symbol length (u32)
    data.writeUInt32LE(symbolBytes.length, offset);
    offset += 4;
  
    // Write name bytes
    data.set(nameBytes, offset);
    offset += nameBytes.length;
  
    // Write symbol bytes
    data.set(symbolBytes, offset);
    offset += symbolBytes.length;
  
    // Write funding goal (u64)
    const fundingGoalBuffer = Buffer.alloc(8);
    fundingGoalBuffer.writeBigUInt64LE(BigInt(fundingGoal));
    data.set(fundingGoalBuffer, offset);
  
    console.log('Instruction data prepared');
    console.log('Sending transaction...');
    
    try {
      // Calculate rent-exempt balance for project account
      const projectRentExemptBalance = await this.provider.connection.getMinimumBalanceForRentExemption(
        PROJECT_ACCOUNT_SIZE
      );
      console.log('Project rent-exempt balance:', projectRentExemptBalance);

      // Calculate rent-exempt balance for token mint
      const mintRentExemptBalance = await this.provider.connection.getMinimumBalanceForRentExemption(
        MINT_SIZE
      );
      console.log('Mint rent-exempt balance:', mintRentExemptBalance);

      // Create token mint account instruction
      const createMintAccountInstruction = SystemProgram.createAccount({
        fromPubkey: this.provider.wallet.publicKey,
        newAccountPubkey: tokenMint.publicKey,
        lamports: mintRentExemptBalance,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      });

      // Initialize token mint instruction
      const initializeMintInstruction = createInitializeMintInstruction(
        tokenMint.publicKey,
        9, // decimals
        projectPda, // mint authority (PDA)
        null, // freeze authority
      );
  
      // Create the project initialization instruction
      const initializeProjectInstruction = new TransactionInstruction({
        programId: this.programId,
        keys: [
          { pubkey: projectPda, isSigner: false, isWritable: true },
          { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: tokenMint.publicKey, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([0, ...data]),
      });
  
      console.log('Initialize instruction keys:', initializeProjectInstruction.keys.map(key => ({ pubkey: key.pubkey.toString(), isSigner: key.isSigner, isWritable: key.isWritable })));

      // Create and send transaction
      const tx = await this.provider.sendAndConfirm(
        new Transaction()
          .add(createMintAccountInstruction)
          .add(initializeMintInstruction)
          .add(initializeProjectInstruction),
        [tokenMint], // token mint needs to sign
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          commitment: 'confirmed',
        }
      );
  
      console.log('Transaction successful:', tx);
      console.log('Token mint created:', tokenMint.publicKey.toString());
      return tx;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  async contribute(
    projectPda: PublicKey,
    amount: number,
    contributorTokenAccount: PublicKey,
    projectToken: PublicKey
  ): Promise<string> {
    const instruction = {
      programId: this.programId,
      keys: [
        { pubkey: projectPda, isSigner: false, isWritable: true },
        { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: contributorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: projectToken, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([
        1, // instruction index for contribute
        ...new Uint8Array(new BigInt64Array([BigInt(amount)]).buffer),
      ]),
    };

    const tx = await this.provider.sendAndConfirm(
      new Transaction().add(instruction)
    );

    return tx;
  }

  async getProject(projectPda: PublicKey): Promise<Project> {
    const accountInfo = await this.provider.connection.getAccountInfo(projectPda);
    if (!accountInfo) {
      console.error('Account info not found for PDA:', projectPda.toString());
      throw new Error('Project not found');
    }

    // Parse account data according to our Rust struct layout (based on Project::LEN)
    const data = accountInfo.data;
    
    let offset = 0;

    // Parse authority (32 bytes)
    const authority = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    // Parse name (32 bytes, potentially zero-padded)
    const nameBytes = data.slice(offset, offset + 32);
    const name = new TextDecoder().decode(nameBytes).replace(/\0/g, ''); // Remove null characters
    offset += 32;
    
    // Parse symbol (8 bytes, potentially zero-padded)
    const symbolBytes = data.slice(offset, offset + 8);
    const symbol = new TextDecoder().decode(symbolBytes).replace(/\0/g, ''); // Remove null characters
    offset += 8;
    
    // Parse funding goal (8 bytes)
    const fundingGoal = Number(data.readBigUInt64LE(offset));
    offset += 8;
    
    // Parse total raised (8 bytes)
    const totalRaised = Number(data.readBigUInt64LE(offset));
    offset += 8;
    
    // Parse token price (8 bytes)
    const tokenPrice = Number(data.readBigUInt64LE(offset));
    offset += 8;
    
    // Parse is_active (1 byte)
    const isActive = Boolean(data[offset]);
    offset += 1;
    
    // Parse bump (1 byte)
    const bump = data[offset];
    offset += 1;

    // Parse token_mint (32 bytes)
    const tokenMintAddress = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    console.log('Parsed project:', {
      authority: authority.toString(),
      name,
      symbol,
      fundingGoal,
      totalRaised,
      tokenPrice,
      isActive,
      bump,
      tokenMintAddress: tokenMintAddress.toString(),
    });

    return {
      authority,
      name,
      symbol,
      fundingGoal,
      totalRaised,
      tokenPrice,
      isActive,
      tokenMintAddress,
    };
  }

  async getProjectPda(authority: PublicKey): Promise<PublicKey> {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from('project'), authority.toBuffer()],
      this.programId
    );
    return pda;
  }

  async getAllProjects(): Promise<Project[]> {
    try {
      // Get all program accounts
      const accounts = await this.provider.connection.getProgramAccounts(
        this.programId,
        {
          commitment: 'confirmed',
          filters: [ /* Removed dataSize filter */ ],
        }
      );

      console.log('Found accounts:', accounts.length);

      // Parse each account into a Project
      const projects = await Promise.all(
        accounts.map(async (account) => {
          try {
            const project = await this.getProject(account.pubkey);
            return project;
          } catch (err) {
            console.error('Error parsing project:', err);
            return null;
          }
        })
      );

      // Filter out any null projects (failed to parse)
      return projects.filter((project): project is Project => project !== null);
    } catch (error) {
      console.error('Error fetching all projects:', error);
      throw error;
    }
  }

  async buyTokens(projectPda: PublicKey, amount: number): Promise<string> {
    console.log('Starting buy tokens...');
    console.log('Buyer wallet:', this.provider.wallet.publicKey.toString());
    console.log('Project PDA:', projectPda.toString());
    console.log('Amount:', amount);

    // Fetch project data to get the token mint address
    const project = await this.getProject(projectPda);
    const projectTokenMintAddress = project.tokenMintAddress;

    // Find the buyer's associated token account address
    const buyerTokenAccountAddress = await getAssociatedTokenAddress(
      projectTokenMintAddress,
      this.provider.wallet.publicKey
    );
    console.log('Buyer Token Account:', buyerTokenAccountAddress.toString());

    // Check if the buyer's associated token account exists
    const buyerTokenAccountInfo = await this.provider.connection.getAccountInfo(buyerTokenAccountAddress);

    const transaction = new Transaction();

    // If account doesn't exist, create it
    if (!buyerTokenAccountInfo) {
        console.log('Buyer token account not found, creating...');
        const createATAInstruction = createAssociatedTokenAccountInstruction(
            this.provider.wallet.publicKey, // payer
            buyerTokenAccountAddress, // ata
            this.provider.wallet.publicKey, // owner
            projectTokenMintAddress, // mint
            TOKEN_PROGRAM_ID, // token program ID
            ASSOCIATED_TOKEN_PROGRAM_ID // associated token program ID
        );
        transaction.add(createATAInstruction);
        console.log('Added create ATA instruction');
    }

    // Create the buy instruction
    const buyInstruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: projectPda, isSigner: false, isWritable: true }, // Project account (PDA)
        { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: true }, // Buyer account
        { pubkey: buyerTokenAccountAddress, isSigner: false, isWritable: true }, // Buyer token account
        { pubkey: projectTokenMintAddress, isSigner: false, isWritable: true }, // Project token mint account
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
      ],
      data: Buffer.from([
        2, // instruction index for buy tokens
        ...new Uint8Array(new BigInt64Array([BigInt(amount)]).buffer),
      ]),
    });
    console.log('Prepared buy instruction');

    // Add the buy instruction to the transaction
    transaction.add(buyInstruction);

    console.log('Sending transaction...');
    // Send the transaction (will contain create ATA if needed, then buy instruction)
    const tx = await this.provider.sendAndConfirm(
      transaction
    );

    console.log('Transaction successful:', tx);
    return tx;
  }

  async sellTokens(projectPda: PublicKey, amount: number): Promise<string> {
    console.log('Starting sell tokens...');
    console.log('Seller wallet:', this.provider.wallet.publicKey.toString());
    console.log('Project PDA:', projectPda.toString());
    console.log('Amount:', amount);

    // Fetch project data to get the token mint address
    const project = await this.getProject(projectPda);
    const projectTokenMintAddress = project.tokenMintAddress;

    // Find the seller's associated token account address
    const sellerTokenAccountAddress = await getAssociatedTokenAddress(
      projectTokenMintAddress,
      this.provider.wallet.publicKey
    );
    console.log('Seller Token Account:', sellerTokenAccountAddress.toString());

    // Create buffer for instruction data
    const data = Buffer.alloc(9); // 1 byte for instruction index + 8 bytes for amount
    data.writeUInt8(3, 0); // Write instruction index (3 for sell tokens)
    
    // Write amount as u64 little-endian
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount));
    data.set(amountBuffer, 1);

    console.log('Instruction data:', Array.from(data));

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: projectPda, isSigner: false, isWritable: true }, // Project account (PDA)
        { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: true }, // Seller account (signer and writable to receive SOL)
        { pubkey: sellerTokenAccountAddress, isSigner: false, isWritable: true }, // Seller token account
        { pubkey: projectTokenMintAddress, isSigner: false, isWritable: true }, // Project token mint account
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // SPL Token program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
      ],
      data,
    });

    console.log('Instruction prepared:', {
      programId: instruction.programId.toString(),
      keys: instruction.keys.map(key => ({
        pubkey: key.pubkey.toString(),
        isSigner: key.isSigner,
        isWritable: key.isWritable
      })),
      dataLength: instruction.data.length
    });

    try {
      console.log('Sending transaction...');
      
      // Create transaction with compute budget
      const transaction = new Transaction();
      
      // Add compute budget instruction FIRST
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 400_000, // Increase from default ~200k to 400k
        })
      );
      
      // Then add your existing instruction
      transaction.add(instruction);

      const tx = await this.provider.sendAndConfirm(
        transaction,
        [], // signers
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          commitment: 'confirmed',
        }
      );
      console.log('Transaction successful:', tx);
      return tx;
    } catch (error: unknown) {
      console.error('Transaction failed:', error);
      
      // Log the full error details
      const err = error as { logs?: string[]; message?: string; code?: number; stack?: string };
      if (err.logs && Array.isArray(err.logs)) {
        console.log('Program logs:');
        err.logs.forEach((log: string, index: number) => {
          console.log(`${index}: ${log}`);
        });
      }

      // Log additional error details if available
      if (err.message) {
        console.error('Error message:', err.message);
      }
      if (err.code) {
        console.error('Error code:', err.code);
      }
      if (err.stack) {
        console.error('Error stack:', err.stack);
      }
      
      throw error;
    }
  }
}