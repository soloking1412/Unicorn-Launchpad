import { AnchorProvider } from '@project-serum/anchor';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Transaction } from '@solana/web3.js';

// Project account size
const PROJECT_ACCOUNT_SIZE = 32 + // authority
  32 + // name
  8 + // symbol
  8 + // funding_goal
  8 + // total_raised
  8 + // token_price
  1 + // is_active
  1; // bump

// Temporary interface until we generate the IDL
interface Project {
  authority: PublicKey;
  name: string;
  symbol: string;
  fundingGoal: number;
  totalRaised: number;
  tokenPrice: number;
  isActive: boolean;
}

export class UnicornFactoryClient {
  private provider: AnchorProvider;
  private programId: PublicKey;

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
    
    // Find PDA and bump
    const [projectPda, bump] = await PublicKey.findProgramAddress(
      [Buffer.from('project'), this.provider.wallet.publicKey.toBuffer()],
      this.programId
    );
    console.log('Generated PDA:', projectPda.toString());
    console.log('Bump:', bump);

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
      // Create the instruction
      const transactionInstruction = new TransactionInstruction({
        programId: this.programId,
        keys: [
          { pubkey: projectPda, isSigner: false, isWritable: true },
          { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([0, ...data]),
      });

      // Create and send transaction
      const tx = await this.provider.sendAndConfirm(
        new Transaction().add(transactionInstruction),
        [], // No additional signers needed
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          commitment: 'confirmed',
        }
      );

      console.log('Transaction successful:', tx);
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
    if (!accountInfo) throw new Error('Project not found');

    // Parse account data according to our Rust struct layout
    const data = accountInfo.data;
    
    // Parse authority (first 32 bytes)
    const authority = new PublicKey(data.slice(0, 32));
    
    // Parse name (next 32 bytes)
    const nameBytes = data.slice(32, 64);
    const name = new TextDecoder().decode(nameBytes).replace(/\0/g, '');
    
    // Parse symbol (next 8 bytes)
    const symbolBytes = data.slice(64, 72);
    const symbol = new TextDecoder().decode(symbolBytes).replace(/\0/g, '');
    
    // Parse funding goal (next 8 bytes)
    const fundingGoal = Number(data.readBigUInt64LE(72));
    
    // Parse total raised (next 8 bytes)
    const totalRaised = Number(data.readBigUInt64LE(80));
    
    // Parse token price (next 8 bytes)
    const tokenPrice = Number(data.readBigUInt64LE(88));
    
    // Parse is_active (next 1 byte)
    const isActive = Boolean(data[96]);
    
    // Parse bump (last 1 byte)
    const bump = data[97];

    console.log('Parsed project:', {
      authority: authority.toString(),
      name,
      symbol,
      fundingGoal,
      totalRaised,
      tokenPrice,
      isActive,
      bump
    });

    return {
      authority,
      name,
      symbol,
      fundingGoal,
      totalRaised,
      tokenPrice,
      isActive,
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
          filters: [
            {
              dataSize: PROJECT_ACCOUNT_SIZE, // Filter by account size
            },
          ],
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
} 