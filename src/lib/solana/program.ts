import { AnchorProvider } from '@project-serum/anchor';
import { PublicKey, SystemProgram, TransactionInstruction, Keypair, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createInitializeMintInstruction, MINT_SIZE, createAssociatedTokenAccountInstruction, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Account sizes (based on Rust program)
const PROJECT_ACCOUNT_SIZE = 32 + // authority
  32 + // name (max 32 bytes)
  8 + // symbol (max 8 bytes)
  8 + // funding_goal
  8 + // total_raised
  8 + // token_price
  1 + // is_active
  1 + // bump
  32 + // token_mint
  1 + // milestone_count
  1; // proposal_count

const PROPOSAL_ACCOUNT_SIZE = 32 + // creator
  32 + // title (max 32 bytes)
  256 + // description (max 256 bytes)
  8 + // amount
  1 + // milestone_id
  8 + // yes_votes
  8 + // no_votes
  1 + // is_executed
  8 + // created_at
  8; // voting_end

const MILESTONE_ACCOUNT_SIZE = 32 + // title (max 32 bytes)
  256 + // description (max 256 bytes)
  8 + // amount
  1 + // is_completed
  8; // completed_at

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
  proposalCount: number;
  milestoneCount: number;
}

export interface Proposal {
  creator: PublicKey;
  title: string;
  description: string;
  amount: number;
  milestoneId: number;
  yesVotes: number;
  noVotes: number;
  isExecuted: boolean;
  createdAt: number;
  votingEnd: number;
}

export interface Milestone {
  title: string;
  description: string;
  amount: number;
  isCompleted: boolean;
  completedAt: number;
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

    // Parse milestone_count (1 byte)
    const milestoneCount = data[offset];
    offset += 1;

    // Parse proposal_count (1 byte)
    const proposalCount = data[offset];
    offset += 1;

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
      milestoneCount,
      proposalCount,
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
      proposalCount,
      milestoneCount,
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
    console.log('Fetching all projects...');
    try {
        // Get all accounts owned by the program
        const accounts = await this.provider.connection.getProgramAccounts(
            this.programId,
            {
                commitment: 'confirmed',
                // We will filter client-side to find Project accounts
            }
        );

        console.log(`Found ${accounts.length} program accounts. Attempting to filter for projects.`);

        const projects: Project[] = [];

        for (const account of accounts) {
            // A project account has a specific structure starting with the authority's public key.
            // We can try to unpack the account as a Project and validate if it looks like one.
            // A more robust method would involve an account type discriminant byte in the Rust program,
            // but for now, we'll rely on unpacking and structural checks.
            if (account.account.data.length >= PROJECT_ACCOUNT_SIZE) { // Check minimum size
                try {
                    const potentialProject = this.unpackProject(account.account.data);
                    
                    // Basic heuristic check: Can the authority be derived back to this PDA?
                    // This is not foolproof but helps filter out non-project accounts.
                    const [expectedProjectPda, _bump] = await PublicKey.findProgramAddress(
                        [Buffer.from('project'), potentialProject.authority.toBuffer()],
                        this.programId
                    );

                    if (expectedProjectPda.equals(account.pubkey)) {
                         // Also check if the unpacked bump matches the derived bump
                        // This requires adding bump to the unpackProject helper
                        // For simplicity now, we just rely on PDA derivation match

                        projects.push({
                            authority: potentialProject.authority,
                            name: potentialProject.name,
                            symbol: potentialProject.symbol,
                            fundingGoal: potentialProject.fundingGoal,
                            totalRaised: potentialProject.totalRaised,
                            tokenPrice: potentialProject.tokenPrice,
                            isActive: potentialProject.isActive,
                            tokenMintAddress: potentialProject.tokenMintAddress,
                            proposalCount: potentialProject.proposalCount,
                            milestoneCount: potentialProject.milestoneCount,
                        });
                    } else {
                       // console.log(`Account ${account.pubkey.toString()} is not a project PDA.`);
                    }
                   
                } catch (error) {
                    // Account data doesn't match Project structure, ignore.
                    // console.log(`Failed to unpack account ${account.pubkey.toString()} as Project:`, error);
                }
            }
        }

        console.log(`Successfully identified ${projects.length} project accounts.`);
        return projects;

    } catch (error) {
        console.error('Error fetching all projects:', error);
        throw error;
    }
  }

  // Helper function to unpack Project data
  private unpackProject(data: Buffer): Project {
        let offset = 0;

        // Unpack authority (32 bytes)
        const authority = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        
        // Unpack name (32 bytes, potentially zero-padded)
        const nameBytes = data.slice(offset, offset + 32);
        const name = new TextDecoder().decode(nameBytes).replace(/\0/g, ''); // Remove null characters
        offset += 32;
        
        // Unpack symbol (8 bytes, potentially zero-padded)
        const symbolBytes = data.slice(offset, offset + 8);
        const symbol = new TextDecoder().decode(symbolBytes).replace(/\0/g, ''); // Remove null characters
        offset += 8;
        
        // Unpack funding goal (8 bytes)
        const fundingGoal = Number(data.readBigUInt64LE(offset));
        offset += 8;
        
        // Unpack total raised (8 bytes)
        const totalRaised = Number(data.readBigUInt64LE(offset));
        offset += 8;
        
        // Unpack token price (8 bytes)
        const tokenPrice = Number(data.readBigUInt64LE(offset));
        offset += 8;
        
        // Unpack is_active (1 byte)
        const isActive = Boolean(data[offset]);
        offset += 1;
        
        // Unpack bump (1 byte)
        const bump = data[offset]; // Keep bump to potentially add validation later
        offset += 1;

        // Unpack token_mint (32 bytes)
        const tokenMintAddress = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        // Unpack milestone_count (1 byte)
        const milestoneCount = data[offset];
        offset += 1;

        // Unpack proposal_count (1 byte)
        const proposalCount = data[offset];
        offset += 1; // Ensure offset matches total size

        return {
            authority,
            name,
            symbol,
            fundingGoal,
            totalRaised,
            tokenPrice,
            isActive,
            tokenMintAddress,
            proposalCount,
            milestoneCount,
        };
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

  async createProposal(
    projectPda: PublicKey,
    proposalIndex: number,
    title: string,
    description: string,
    amount: number,
    milestoneId: number
  ): Promise<string> {
    console.log('Creating proposal...');
    console.log('Project PDA:', projectPda.toString());
    console.log('Proposal Index:', proposalIndex);

    // Find the PDA for the new proposal account
    const [proposalAccountPda, proposalBump] = await PublicKey.findProgramAddress(
        [Buffer.from('proposal'), projectPda.toBuffer(), Buffer.from([proposalIndex])],
        this.programId
    );
    console.log('Proposal PDA:', proposalAccountPda.toString());

    // Convert strings to UTF-8 bytes
    const titleBytes = new TextEncoder().encode(title);
    const descriptionBytes = new TextEncoder().encode(description);

    // Create instruction data buffer
    // 1 (instruction index) + 4 (title len) + 4 (desc len) + title.length + desc.length + 8 (amount) + 1 (milestoneId)
    const data = Buffer.alloc(1 + 4 + 4 + titleBytes.length + descriptionBytes.length + 8 + 1);
    let offset = 0;

    // Write instruction index (u8)
    data.writeUInt8(4, offset);
    offset += 1;
    
    // Write title length (u32)
    data.writeUInt32LE(titleBytes.length, offset);
    offset += 4;

    // Write description length (u32)
    data.writeUInt32LE(descriptionBytes.length, offset);
    offset += 4;

    // Write title bytes
    data.set(titleBytes, offset);
    offset += titleBytes.length;

    // Write description bytes
    data.set(descriptionBytes, offset);
    offset += descriptionBytes.length;

    // Write amount (u64)
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount));
    data.set(amountBuffer, offset);
    offset += 8;
    
    // Write milestone ID (u8)
    data.writeUInt8(milestoneId, offset);
    
    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: projectPda, isSigner: false, isWritable: true }, // Project account (PDA)
        { pubkey: proposalAccountPda, isSigner: false, isWritable: true }, // New Proposal account (PDA)
        { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: true }, // Authority account (Signer)
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
      dataLength: instruction.data.length,
      data: Array.from(instruction.data) // Log data bytes
    });

    try {
      console.log('Sending transaction...');
      const tx = await this.provider.sendAndConfirm(
        new Transaction().add(instruction)
      );
      console.log('Transaction successful:', tx);
      return tx;
    } catch (error: any) {
      console.error('Transaction failed:', error);
      if (error.logs) {
        console.error('Transaction logs:', error.logs);
      }
      throw error;
    }
  }

  // FIXED: Vote function - consistent with Rust contract
  async vote(
    projectPda: PublicKey,
    proposalId: number,
    vote: boolean
  ): Promise<string> {
    console.log('Voting on proposal...');
    console.log('Project PDA:', projectPda.toString());
    console.log('Proposal ID:', proposalId);
    console.log('Vote (true for yes, false for no):', vote);

    // FIXED: Use single byte like create_proposal (not 8-byte buffer)
    const [proposalAccountPda, proposalBump] = await PublicKey.findProgramAddress(
        [Buffer.from('proposal'), projectPda.toBuffer(), Buffer.from([proposalId])],
        this.programId
    );
    console.log('Proposal PDA:', proposalAccountPda.toString());

    const data = Buffer.alloc(9); // 8 bytes for proposal ID + 1 byte for vote
    data.writeBigUInt64LE(BigInt(proposalId), 0);
    data.writeUInt8(vote ? 1 : 0, 8);

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: projectPda, isSigner: false, isWritable: false }, // Project account (Readonly)
        { pubkey: proposalAccountPda, isSigner: false, isWritable: true }, // Proposal account (PDA - writable to update votes)
        { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: false }, // Voter account (Signer, Readonly)
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
      ],
      data: Buffer.from([5, ...data]), // 5 is the instruction index for vote
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
      const tx = await this.provider.sendAndConfirm(
        new Transaction().add(instruction)
      );
      console.log('Transaction successful:', tx);
      return tx;
    } catch (error: any) {
      console.error('Transaction failed:', error);
      if (error.logs) {
        console.error('Transaction logs:', error.logs);
      }
      throw error;
    }
  }

  // FIXED: ReleaseFunds function - consistent with Rust contract
  async releaseFunds(
    projectPda: PublicKey,
    proposalId: number
  ): Promise<string> {
    console.log('Releasing funds for proposal...');
    console.log('Project PDA:', projectPda.toString());
    console.log('Proposal ID:', proposalId);

    // FIXED: Use single byte like create_proposal (not 8-byte buffer)
    const [proposalAccountPda, proposalBump] = await PublicKey.findProgramAddress(
        [Buffer.from('proposal'), projectPda.toBuffer(), Buffer.from([proposalId])],
        this.programId
    );
    console.log('Proposal PDA:', proposalAccountPda.toString());

    // Instruction data remains the same as before, containing just the proposal ID
    const data = Buffer.alloc(8);
    data.writeBigUInt64LE(BigInt(proposalId), 0);

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: projectPda, isSigner: false, isWritable: true }, // Project account (PDA - writable to send SOL)
        { pubkey: proposalAccountPda, isSigner: false, isWritable: true }, // Proposal account (PDA - writable to mark as executed)
        { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: true }, // Authority account (Signer, writable to receive SOL)
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
      ],
      data: Buffer.from([6, ...data]), // 6 is the instruction index for release funds
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
      const tx = await this.provider.sendAndConfirm(
        new Transaction().add(instruction)
      );
      console.log('Transaction successful:', tx);
      return tx;
    } catch (error: any) {
      console.error('Transaction failed:', error);
      if (error.logs) {
        console.error('Transaction logs:', error.logs);
      }
      throw error;
    }
  }

  async addMilestone(
    projectPda: PublicKey,
    milestoneIndex: number,
    title: string,
    description: string,
    amount: number
  ): Promise<string> {
    console.log('Adding milestone...');

    // Find the PDA for the new milestone account
    const [milestoneAccountPda, milestoneBump] = await PublicKey.findProgramAddress(
        [Buffer.from('milestone'), projectPda.toBuffer(), Buffer.from([milestoneIndex])],
        this.programId
    );
    console.log('Milestone PDA:', milestoneAccountPda.toString());

    // Convert strings to UTF-8 bytes
    const titleBytes = new TextEncoder().encode(title);
    const descriptionBytes = new TextEncoder().encode(description);

    // Create instruction data buffer
    const data = Buffer.alloc(4 + 4 + 24 + titleBytes.length + descriptionBytes.length + 8);
    let offset = 0;

    // Write title length (u32)
    data.writeUInt32LE(titleBytes.length, offset);
    offset += 4;

    // Write description length (u32)
    data.writeUInt32LE(descriptionBytes.length, offset);
    offset += 4;

    // Add 24 bytes of padding to match Rust program's expected offset
    offset += 24;

    // Write title bytes
    data.set(titleBytes, offset);
    offset += titleBytes.length;

    // Write description bytes
    data.set(descriptionBytes, offset);
    offset += descriptionBytes.length;

    // Write amount (u64)
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount));
    data.set(amountBuffer, offset);

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: projectPda, isSigner: false, isWritable: true }, // Project account (PDA) - Index 0
        { pubkey: milestoneAccountPda, isSigner: false, isWritable: true }, // Milestone account (PDA) - Index 1
        { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: true }, // Authority account (Signer) - Index 2
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program - Index 3
      ],
      data: Buffer.from([7, ...data]), // 7 is the instruction index for add milestone
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
      const tx = await this.provider.sendAndConfirm(
        new Transaction().add(instruction)
      );
      console.log('Transaction successful:', tx);
      return tx;
    } catch (error: any) {
      console.error('Transaction failed:', error);
      if (error.logs) {
        console.error('Transaction logs:', error.logs);
      }
      throw error;
    }
  }

  async completeMilestone(
    projectPda: PublicKey,
    milestoneId: number
  ): Promise<string> {
    console.log('Completing milestone...');

    // Find the PDA for the milestone account
    const [milestoneAccountPda, milestoneBump] = await PublicKey.findProgramAddress(
        [Buffer.from('milestone'), projectPda.toBuffer(), Buffer.from([milestoneId])],
        this.programId
    );
    console.log('Milestone PDA:', milestoneAccountPda.toString());

    const data = Buffer.alloc(1);
    data.writeUInt8(milestoneId, 0);

    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: projectPda, isSigner: false, isWritable: false }, // Project account (Readonly, not modified by this instruction)
        { pubkey: milestoneAccountPda, isSigner: false, isWritable: true }, // Milestone account (PDA)
        { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: false }, // Authority account (Signer, not modified)
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
      ],
      data: Buffer.from([8, ...data]), // 8 is the instruction index for complete milestone
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
      const tx = await this.provider.sendAndConfirm(
        new Transaction().add(instruction)
      );
      console.log('Transaction successful:', tx);
      return tx;
    } catch (error: any) {
      console.error('Transaction failed:', error);
      if (error.logs) {
        console.error('Transaction logs:', error.logs);
      }
      throw error;
    }
  }

  // FIXED: GetProposal function - consistent with Rust contract
  async getProposal(projectPda: PublicKey, proposalId: number): Promise<Proposal> {
    console.log('Fetching proposal...');
    console.log('Project PDA:', projectPda.toString());
    console.log('Proposal ID:', proposalId);

    // FIXED: Use single byte like create_proposal (not 8-byte buffer)
    const [proposalAccountPda, _bump] = await PublicKey.findProgramAddress(
        [Buffer.from('proposal'), projectPda.toBuffer(), Buffer.from([proposalId])],
        this.programId
    );
    console.log('Proposal PDA:', proposalAccountPda.toString());

    const accountInfo = await this.provider.connection.getAccountInfo(proposalAccountPda);
    if (!accountInfo) {
      console.error('Account info not found for Proposal PDA:', proposalAccountPda.toString());
      throw new Error('Proposal not found');
    }

    // Parse account data according to the Proposal struct layout
    const data = accountInfo.data;
    let offset = 0;

    // Parse creator (32 bytes)
    const creator = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    // Parse title (32 bytes)
    const title = new TextDecoder().decode(data.slice(offset, offset + 32)).replace(/\0/g, '');
    offset += 32;
    
    // Parse description (256 bytes)
    const description = new TextDecoder().decode(data.slice(offset, offset + 256)).replace(/\0/g, '');
    offset += 256;
    
    // Parse amount (8 bytes)
    const amount = Number(data.readBigUInt64LE(offset));
    offset += 8;
    
    // Parse milestone ID (1 byte)
    const milestoneId = data[offset];
    offset += 1;
    
    // Parse yes votes (8 bytes)
    const yesVotes = Number(data.readBigUInt64LE(offset));
    offset += 8;
    
    // Parse no votes (8 bytes)
    const noVotes = Number(data.readBigUInt64LE(offset));
    offset += 8;
    
    // Parse is executed (1 byte)
    const isExecuted = Boolean(data[offset]);
    offset += 1;
    
    // Parse created at (8 bytes)
    const createdAt = Number(data.readBigInt64LE(offset));
    offset += 8;
    
    // Parse voting end (8 bytes)
    const votingEnd = Number(data.readBigInt64LE(offset));

    console.log('Parsed proposal:', {
        creator: creator.toString(),
        title,
        description,
        amount,
        milestoneId,
        yesVotes,
        noVotes,
        isExecuted,
        createdAt,
        votingEnd,
    });

    return {
      creator,
      title,
      description,
      amount,
      milestoneId,
      yesVotes,
      noVotes,
      isExecuted,
      createdAt,
      votingEnd,
    };
  }

  async getMilestone(projectPda: PublicKey, milestoneId: number): Promise<Milestone> {
    console.log('Fetching milestone...');
    console.log('Project PDA:', projectPda.toString());
    console.log('Milestone ID:', milestoneId);

    // Find the PDA for the specific milestone account
    const [milestoneAccountPda, _bump] = await PublicKey.findProgramAddress(
        [Buffer.from('milestone'), projectPda.toBuffer(), Buffer.from([milestoneId])],
        this.programId
    );
    console.log('Milestone PDA:', milestoneAccountPda.toString());

    const accountInfo = await this.provider.connection.getAccountInfo(milestoneAccountPda);
    if (!accountInfo) {
        console.error('Account info not found for Milestone PDA:', milestoneAccountPda.toString());
      throw new Error('Milestone not found');
    }

    // Parse account data according to the Milestone struct layout
    const data = accountInfo.data;
    let offset = 0;

    // Parse title (32 bytes)
    const title = new TextDecoder().decode(data.slice(offset, offset + 32)).replace(/\0/g, '');
    offset += 32;
    
    // Parse description (256 bytes)
    const description = new TextDecoder().decode(data.slice(offset, offset + 256)).replace(/\0/g, '');
    offset += 256;
    
    // Parse amount (8 bytes)
    const amount = Number(data.readBigUInt64LE(offset));
    offset += 8;
    
    // Parse is completed (1 byte)
    const isCompleted = Boolean(data[offset]);
    offset += 1;
    
    // Parse completed at (8 bytes)
    const completedAt = Number(data.readBigInt64LE(offset));

    console.log('Parsed milestone:', {
        title,
        description,
        amount,
        isCompleted,
        completedAt,
    });

    return {
      title,
      description,
      amount,
      isCompleted,
      completedAt,
    };
  }

  async getAllProposals(): Promise<Proposal[]> {
    console.log('Fetching all proposals...');
    try {
        // Get all accounts owned by the program
        const accounts = await this.provider.connection.getProgramAccounts(
            this.programId,
            {
                commitment: 'confirmed',
                // Consider adding filters if needed, e.g., based on data size or a specific tag
            }
        );

        console.log(`Found ${accounts.length} program accounts. Attempting to parse proposals.`);

        const proposals: Proposal[] = [];

        for (const account of accounts) {
            // Attempt to parse the account data as a Proposal
            // We check data length to filter for potential proposal accounts
            if (account.account.data.length === PROPOSAL_ACCOUNT_SIZE) {
                try {
                    const proposal = this.unpackProposal(account.account.data);
                    // Optional: Add a check here if the PDA matches the expected proposal PDA derivation
                    // This would require knowing the project PDA and proposal ID from the account data,
                    // which isn't directly available in the current Proposal struct.
                    proposals.push(proposal);
                } catch (error) {
                    // This account is likely not a Proposal, or data is malformed
                    // console.log(`Failed to unpack account ${account.pubkey.toString()} as Proposal:`, error);
                }
            } else {
                 // console.log(`Skipping account ${account.pubkey.toString()} with data length ${account.account.data.length} (expected ${Proposal.LEN})`);
            }
        }

        console.log(`Successfully parsed ${proposals.length} proposals.`);
        return proposals;

    } catch (error) {
        console.error('Error fetching all proposals:', error);
        throw error;
    }
  }

  // Helper function to unpack Proposal data (can be made public if needed elsewhere)
  private unpackProposal(data: Buffer): Proposal {
        let offset = 0;

        const creator = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        const title = new TextDecoder().decode(data.slice(offset, offset + 32)).replace(/\0/g, '');
        offset += 32;

        const description = new TextDecoder().decode(data.slice(offset, offset + 256)).replace(/\0/g, '');
        offset += 256;

        const amount = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const milestoneId = data[offset];
        offset += 1;

        const yesVotes = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const noVotes = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const isExecuted = Boolean(data[offset]);
        offset += 1;

        const createdAt = Number(data.readBigInt64LE(offset));
        offset += 8;

        const votingEnd = Number(data.readBigInt64LE(offset));

        return {
            creator,
            title,
            description,
            amount,
            milestoneId,
            yesVotes,
            noVotes,
            isExecuted,
            createdAt,
            votingEnd,
        };
  }

  // Helper function to unpack Milestone data (can be made public if needed elsewhere)
  private unpackMilestone(data: Buffer): Milestone {
        let offset = 0;

        const title = new TextDecoder().decode(data.slice(offset, offset + 32)).replace(/\0/g, '');
        offset += 32;

        const description = new TextDecoder().decode(data.slice(offset, offset + 256)).replace(/\0/g, '');
        offset += 256;

        const amount = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const isCompleted = Boolean(data[offset]);
        offset += 1;

        const completedAt = Number(data.readBigInt64LE(offset));

        return {
            title,
            description,
            amount,
            isCompleted,
            completedAt,
        };
  }
}