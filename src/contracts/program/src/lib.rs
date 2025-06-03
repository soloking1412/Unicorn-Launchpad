use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    system_instruction,
    system_program,
    sysvar::{rent::Rent, Sysvar},
};
use spl_token::instruction as token_instruction;

// Program entrypoint
entrypoint!(process_instruction);

// Program ID will be replaced after deployment
pub const PROGRAM_ID: &str = "E95C9BgCrrt6Sy8MUbBPTVEEQJSR5Hyau2gAiuAdhb6Y";

// Instruction enum
#[derive(Debug)]
pub enum UnicornFactoryInstruction {
    InitializeProject {
        name: String,
        symbol: String,
        funding_goal: u64,
    },
    Contribute {
        amount: u64,
    },
    BuyTokens {
        amount: u64,
    },
    SellTokens {
        amount: u64,
    },
}

impl UnicornFactoryInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        if input.is_empty() {
            return Err(ProgramError::InvalidInstructionData);
        }

        let (tag, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        
        match tag {
            0 => {
                if rest.len() < 8 {
                    return Err(ProgramError::InvalidInstructionData);
                }
                let name_len = u32::from_le_bytes(rest[0..4].try_into().unwrap()) as usize;
                let symbol_len = u32::from_le_bytes(rest[4..8].try_into().unwrap()) as usize;
                
                if rest.len() < 8 + name_len + symbol_len + 8 {
                    return Err(ProgramError::InvalidInstructionData);
                }
                
                let name = String::from_utf8(rest[8..8 + name_len].to_vec())
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                let symbol = String::from_utf8(rest[8 + name_len..8 + name_len + symbol_len].to_vec())
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                let funding_goal = u64::from_le_bytes(rest[8 + name_len + symbol_len..8 + name_len + symbol_len + 8].try_into().unwrap());
                
                Ok(UnicornFactoryInstruction::InitializeProject {
                    name,
                    symbol,
                    funding_goal,
                })
            }
            1 => {
                if rest.len() < 8 {
                    return Err(ProgramError::InvalidInstructionData);
                }
                let amount = u64::from_le_bytes(rest[0..8].try_into().unwrap());
                Ok(UnicornFactoryInstruction::Contribute { amount })
            }
            2 => {
                if rest.len() < 8 {
                    return Err(ProgramError::InvalidInstructionData);
                }
                let amount = u64::from_le_bytes(rest[0..8].try_into().unwrap());
                Ok(UnicornFactoryInstruction::BuyTokens { amount })
            }
            3 => {
                if rest.len() < 8 {
                    return Err(ProgramError::InvalidInstructionData);
                }
                let amount = u64::from_le_bytes(rest[0..8].try_into().unwrap());
                Ok(UnicornFactoryInstruction::SellTokens { amount })
            }
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

// Project account structure
#[derive(Debug)]
pub struct Project {
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub funding_goal: u64,
    pub total_raised: u64,
    pub token_price: u64,
    pub is_active: bool,
    pub bump: u8,
    pub token_mint: Pubkey,
}

impl Project {
    pub const LEN: usize = 32 + // authority
        32 + // name
        8 + // symbol
        8 + // funding_goal
        8 + // total_raised
        8 + // token_price
        1 + // is_active
        1 + // bump
        32; // token_mint

    pub fn pack(&self, dst: &mut [u8]) {
        let mut offset = 0;
        
        // Pack authority
        dst[offset..offset + 32].copy_from_slice(&self.authority.to_bytes());
        offset += 32;
        
        // Pack name
        let name_bytes = self.name.as_bytes();
        let mut name_buffer = [0u8; 32];
        let len = std::cmp::min(name_bytes.len(), 32);
        name_buffer[..len].copy_from_slice(&name_bytes[..len]);
        dst[offset..offset + 32].copy_from_slice(&name_buffer);
        offset += 32;
        
        // Pack symbol
        let symbol_bytes = self.symbol.as_bytes();
        let mut symbol_buffer = [0u8; 8];
        let len = std::cmp::min(symbol_bytes.len(), 8);
        symbol_buffer[..len].copy_from_slice(&symbol_bytes[..len]);
        dst[offset..offset + 8].copy_from_slice(&symbol_buffer);
        offset += 8;
        
        // Pack funding_goal
        dst[offset..offset + 8].copy_from_slice(&self.funding_goal.to_le_bytes());
        offset += 8;
        
        // Pack total_raised
        dst[offset..offset + 8].copy_from_slice(&self.total_raised.to_le_bytes());
        offset += 8;
        
        // Pack token_price
        dst[offset..offset + 8].copy_from_slice(&self.token_price.to_le_bytes());
        offset += 8;
        
        // Pack is_active
        dst[offset] = self.is_active as u8;
        offset += 1;
        
        // Pack bump
        dst[offset] = self.bump;
        offset += 1;

        // Pack token_mint
        dst[offset..offset + 32].copy_from_slice(&self.token_mint.to_bytes());
    }

    pub fn unpack(src: &[u8]) -> Result<Self, ProgramError> {
        let mut offset = 0;
        
        // Unpack authority
        let authority = Pubkey::try_from(&src[offset..offset + 32])
            .map_err(|_| ProgramError::InvalidAccountData)?;
        offset += 32;
        
        // Unpack name
        let name = String::from_utf8(src[offset..offset + 32].to_vec())
            .map_err(|_| ProgramError::InvalidAccountData)?
            .trim_end_matches('\0')
            .to_string();
        offset += 32;
        
        // Unpack symbol
        let symbol = String::from_utf8(src[offset..offset + 8].to_vec())
            .map_err(|_| ProgramError::InvalidAccountData)?
            .trim_end_matches('\0')
            .to_string();
        offset += 8;
        
        // Unpack funding_goal
        let funding_goal = u64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
        offset += 8;
        
        // Unpack total_raised
        let total_raised = u64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
        offset += 8;
        
        // Unpack token_price
        let token_price = u64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
        offset += 8;
        
        // Unpack is_active
        let is_active = src[offset] != 0;
        offset += 1;
        
        // Unpack bump
        let bump = src[offset];
        offset += 1;

        // Unpack token_mint
        let token_mint = Pubkey::try_from(&src[offset..offset + 32])
            .map_err(|_| ProgramError::InvalidAccountData)?;

        Ok(Project {
            authority,
            name,
            symbol,
            funding_goal,
            total_raised,
            token_price,
            is_active,
            bump,
            token_mint,
        })
    }
}

// Program errors
#[derive(Debug)]
pub enum UnicornFactoryError {
    ProjectNotActive,
    FundingGoalReached,
    Overflow,
    InvalidAmount,
    InvalidProjectAccount,
    InvalidAuthority,
}

impl From<UnicornFactoryError> for ProgramError {
    fn from(e: UnicornFactoryError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

// Helper functions for bonding curve calculations
fn calculate_tokens(amount: u64, current_price: u64) -> u64 {
    amount.checked_div(current_price).unwrap_or(0)
}

fn calculate_new_price(total_raised: u64, funding_goal: u64) -> u64 {
    let price_increase = total_raised
        .checked_mul(100)
        .unwrap_or(0)
        .checked_div(funding_goal)
        .unwrap_or(0);
    1 + price_increase
}

// Main program logic
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = UnicornFactoryInstruction::unpack(instruction_data)?;
    
    match instruction {
        UnicornFactoryInstruction::InitializeProject {
            name,
            symbol,
            funding_goal,
        } => {
            msg!("Instruction: Initialize Project");
            process_initialize_project(program_id, accounts, name, symbol, funding_goal)
        }
        UnicornFactoryInstruction::Contribute { amount } => {
            msg!("Instruction: Contribute");
            process_contribute(accounts, amount)
        }
        UnicornFactoryInstruction::BuyTokens { amount } => {
            msg!("Instruction: Buy Tokens");
            process_buy_tokens(accounts, amount)
        }
        UnicornFactoryInstruction::SellTokens { amount } => {
            msg!("Instruction: Sell Tokens");
            process_sell_tokens(accounts, amount)
        }
    }
}

// Initialize project instruction processor
fn process_initialize_project(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    name: String,
    symbol: String,
    funding_goal: u64,
) -> ProgramResult {
    msg!("Starting project initialization");
    let account_info_iter = &mut accounts.iter();
    
    let project_account = next_account_info(account_info_iter)?;
    msg!("Processing account 0: Project Account key: {}", project_account.key);

    let authority_account = next_account_info(account_info_iter)?;
    msg!("Processing account 1: Authority Account key: {}", authority_account.key);

    let system_program = next_account_info(account_info_iter)?;
    msg!("Processing account 2: System Program key: {}", system_program.key);

    let token_program = next_account_info(account_info_iter)?;
    msg!("Processing account 3: Token Program key: {}", token_program.key);

    let token_mint_account = next_account_info(account_info_iter)?;
    msg!("Processing account 4: Token Mint Account key: {}", token_mint_account.key);

    // Verify authority is signer
    if !authority_account.is_signer {
        msg!("Authority is not a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify system program
    if system_program.key != &system_program::id() {
        msg!("Invalid system program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Verify token program
    if token_program.key != &spl_token::id() {
        msg!("Invalid token program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Find PDA bump
    let (pda, bump) = Pubkey::find_program_address(
        &[b"project", authority_account.key.as_ref()],
        program_id,
    );

    msg!("Generated PDA: {}", pda);
    msg!("Bump: {}", bump);

    // Verify PDA matches
    if pda != *project_account.key {
        msg!("Invalid project account. Expected: {}, Got: {}", pda, project_account.key);
        return Err(UnicornFactoryError::InvalidProjectAccount.into());
    }

    // Verify project account is not already initialized
    if project_account.data.borrow().iter().any(|&x| x != 0) {
        msg!("Project account already initialized");
        return Err(UnicornFactoryError::InvalidProjectAccount.into());
    }
    
    // Create project account
    let project = Project {
        authority: *authority_account.key,
        name: name.clone(),
        symbol: symbol.clone(),
        funding_goal,
        total_raised: 0,
        token_price: 1,
        is_active: true,
        bump,
        token_mint: *token_mint_account.key,
    };
    
    msg!("Project data prepared: name={}, symbol={}, funding_goal={}, token_mint={}", name, symbol, funding_goal, project.token_mint);
    
    // Calculate account size and rent
    let rent = Rent::get()?;
    let space = Project::LEN;
    let lamports = rent.minimum_balance(space);
    
    msg!("Account space: {}, Lamports: {}", space, lamports);
    
    // Create account with PDA as signer
    let seeds = &[
        b"project".as_ref(),
        authority_account.key.as_ref(),
        &[bump],
    ];
    
    msg!("Creating project account with seeds: {:?}", seeds);
    
    // Create the account using invoke_signed
    invoke_signed(
        &system_instruction::create_account(
            authority_account.key,
            project_account.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[authority_account.clone(), project_account.clone(), system_program.clone()],
        &[seeds],
    )?;
    
    msg!("Account created successfully");
    
    // Pack project data
    let mut project_data = vec![0; Project::LEN];
    project.pack(&mut project_data);
    project_account.data.borrow_mut().copy_from_slice(&project_data);
    
    msg!("Project initialized successfully");
    Ok(())
}

// Contribute instruction processor - Fixed seeds
fn process_contribute(
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let project_account = next_account_info(account_info_iter)?;
    let contributor_account = next_account_info(account_info_iter)?;
    let contributor_token_account = next_account_info(account_info_iter)?;
    let project_token = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let _system_program = next_account_info(account_info_iter)?;
    
    // Verify contributor is signer
    if !contributor_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Load and verify project
    let project_data = project_account.data.borrow();
    let mut project = Project::unpack(&project_data)?;
    
    drop(project_data);
    
    if !project.is_active {
        return Err(UnicornFactoryError::ProjectNotActive.into());
    }
    
    if project.total_raised >= project.funding_goal {
        return Err(UnicornFactoryError::FundingGoalReached.into());
    }
    
    // Calculate tokens to mint
    let tokens_to_mint = calculate_tokens(amount, project.token_price);
    
    // Transfer SOL from contributor to project
    invoke(
        &system_instruction::transfer(
            contributor_account.key,
            project_account.key,
            amount,
        ),
        &[contributor_account.clone(), project_account.clone()],
    )?;
    
    // Mint tokens to contributor - Fixed seeds
    let seeds = &[
        b"project".as_ref(),
        project.authority.as_ref(),
        &[project.bump],
    ];
    
    invoke_signed(
        &token_instruction::mint_to(
            token_program.key,
            project_token.key,
            contributor_token_account.key,
            project_account.key,
            &[],
            tokens_to_mint,
        )?,
        &[
            project_token.clone(),
            contributor_token_account.clone(),
            project_account.clone(),
        ],
        &[seeds],
    )?;
    
    // Update project state
    project.total_raised = project.total_raised
        .checked_add(amount)
        .ok_or(UnicornFactoryError::Overflow)?;
    project.token_price = calculate_new_price(project.total_raised, project.funding_goal);
    
    // Check if funding goal is reached
    if project.total_raised >= project.funding_goal {
        project.is_active = false;
    }
    
    // Pack updated project data
    let mut project_data = vec![0; Project::LEN];
    project.pack(&mut project_data);
    project_account.data.borrow_mut().copy_from_slice(&project_data);
    
    Ok(())
}

// Buy tokens instruction processor - Fixed seeds
fn process_buy_tokens(
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let project_account = next_account_info(account_info_iter)?;
    let buyer_account = next_account_info(account_info_iter)?;
    let buyer_token_account = next_account_info(account_info_iter)?;
    let project_token = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let _system_program = next_account_info(account_info_iter)?;
    
    // Verify buyer is signer
    if !buyer_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Load and verify project
    let project_data = project_account.data.borrow();
    let mut project = Project::unpack(&project_data)?;
    
    drop(project_data);
    
    if !project.is_active {
        return Err(UnicornFactoryError::ProjectNotActive.into());
    }
    
    // Calculate tokens to mint based on current price
    let tokens_to_mint = calculate_tokens(amount, project.token_price);
    
    // Transfer SOL from buyer to project
    invoke(
        &system_instruction::transfer(
            buyer_account.key,
            project_account.key,
            amount,
        ),
        &[buyer_account.clone(), project_account.clone()],
    )?;
    
    // Mint tokens to buyer - Fixed seeds
    let seeds = &[
        b"project".as_ref(),
        project.authority.as_ref(),
        &[project.bump],
    ];
    
    invoke_signed(
        &token_instruction::mint_to(
            token_program.key,
            project_token.key,
            buyer_token_account.key,
            project_account.key,
            &[],
            tokens_to_mint,
        )?,
        &[
            project_token.clone(),
            buyer_token_account.clone(),
            project_account.clone(),
        ],
        &[seeds],
    )?;
    
    // Update project state
    project.total_raised = project.total_raised
        .checked_add(amount)
        .ok_or(UnicornFactoryError::Overflow)?;
    project.token_price = calculate_new_price(project.total_raised, project.funding_goal);
    
    // Check if funding goal is reached
    if project.total_raised >= project.funding_goal {
        project.is_active = false;
    }
    
    // Pack updated project data
    let mut project_data = vec![0; Project::LEN];
    project.pack(&mut project_data);
    project_account.data.borrow_mut().copy_from_slice(&project_data);
    
    Ok(())
}

// Sell tokens instruction processor - Corrected account list for invoke
fn process_sell_tokens(
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    msg!("=== SELL TOKENS START ===");
    msg!("Amount to sell: {}", amount);
    
    // Log all received accounts first
    msg!("Total accounts received: {}", accounts.len());
    for (i, account) in accounts.iter().enumerate() {
        msg!("Account {}: key={}, owner={}, lamports={}, data_len={}, executable={}, is_signer={}, is_writable={}", 
             i, account.key, account.owner, account.lamports(), 
             account.data_len(), account.executable, account.is_signer, account.is_writable);
    }
    
    let account_info_iter = &mut accounts.iter();
    let project_account = next_account_info(account_info_iter)?;
    msg!("✓ Project account loaded: {}", project_account.key);
    
    let seller_account = next_account_info(account_info_iter)?;
    msg!("✓ Seller account loaded: {}", seller_account.key);
    
    let seller_token_account = next_account_info(account_info_iter)?;
    msg!("✓ Seller token account loaded: {}", seller_token_account.key);
    
    let project_token = next_account_info(account_info_iter)?;
    msg!("✓ Project token loaded: {}", project_token.key);
    
    let token_program = next_account_info(account_info_iter)?;
    msg!("✓ Token program loaded: {}", token_program.key);
    
    let system_program = next_account_info(account_info_iter)?;
    msg!("✓ System program loaded: {}", system_program.key);
    
    // Comprehensive account validations
    msg!("=== VALIDATION PHASE ===");
    
    // Verify seller is signer
    if !seller_account.is_signer {
        msg!("❌ ERROR: Seller is not a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    msg!("✓ Seller is signer");
    
    // Verify token program ID
    if token_program.key != &spl_token::id() {
        msg!("❌ ERROR: Invalid token program. Expected: {}, Got: {}", spl_token::id(), token_program.key);
        return Err(ProgramError::IncorrectProgramId);
    }
    msg!("✓ Token program ID correct");
    
    // Verify system program ID  
    if system_program.key != &system_program::id() {
        msg!("❌ ERROR: Invalid system program. Expected: {}, Got: {}", system_program::id(), system_program.key);
        return Err(ProgramError::IncorrectProgramId);
    }
    msg!("✓ System program ID correct");
    
    // Load and verify project
    msg!("=== PROJECT LOADING ===");
    let project_data = project_account.data.borrow();
    let mut project = Project::unpack(&project_data)?;
    msg!("✓ Project loaded: name={}, authority={}, total_raised={}, token_price={}, token_mint={}", 
         project.name, project.authority, project.total_raised, project.token_price, project.token_mint);
    
    drop(project_data);
    
    if !project.is_active {
        msg!("❌ ERROR: Project is not active");
        return Err(UnicornFactoryError::ProjectNotActive.into());
    }
    msg!("✓ Project is active");
    
    // Verify project token mint matches
    if project.token_mint != *project_token.key {
        msg!("❌ ERROR: Project token mint mismatch. Project mint: {}, Provided mint: {}", 
             project.token_mint, project_token.key);
        return Err(ProgramError::InvalidAccountData);
    }
    msg!("✓ Project token mint matches");
    
    // Check seller token account
    msg!("=== SELLER TOKEN ACCOUNT VALIDATION ===");
    if seller_token_account.data_is_empty() {
        msg!("❌ ERROR: Seller token account is empty/doesn't exist");
        return Err(ProgramError::UninitializedAccount);
    }
    msg!("✓ Seller token account exists");
    
    if seller_token_account.owner != &spl_token::id() {
        msg!("❌ ERROR: Seller token account owner mismatch. Expected: {}, Got: {}", 
             spl_token::id(), seller_token_account.owner);
        return Err(ProgramError::IncorrectProgramId);
    }
    msg!("✓ Seller token account owned by token program");
    
    // Parse seller token account data
    let seller_token_data = seller_token_account.try_borrow_data()?;
    if seller_token_data.len() != spl_token::state::Account::LEN {
        msg!("❌ ERROR: Invalid token account data length. Expected: {}, Got: {}", 
             spl_token::state::Account::LEN, seller_token_data.len());
        return Err(ProgramError::InvalidAccountData);
    }
    msg!("✓ Seller token account data length correct");
    
    let seller_token_info = spl_token::state::Account::unpack(&seller_token_data)?;
    msg!("✓ Seller token account parsed successfully");
    msg!("  - Balance: {}", seller_token_info.amount);
    msg!("  - Mint: {}", seller_token_info.mint);
    msg!("  - Owner: {}", seller_token_info.owner);
    msg!("  - Delegate: {:?}", seller_token_info.delegate);
    msg!("  - State: {:?}", seller_token_info.state);
    
    // Validate token account details
    if seller_token_info.amount < amount {
        msg!("❌ ERROR: Insufficient token balance. Has: {}, Needs: {}", 
             seller_token_info.amount, amount);
        return Err(UnicornFactoryError::InvalidAmount.into());
    }
    msg!("✓ Sufficient token balance");
    
    if seller_token_info.mint != *project_token.key {
        msg!("❌ ERROR: Token account mint mismatch. Expected: {}, Got: {}", 
             project_token.key, seller_token_info.mint);
        return Err(ProgramError::InvalidAccountData);
    }
    msg!("✓ Token account mint correct");
    
    if seller_token_info.owner != *seller_account.key {
        msg!("❌ ERROR: Token account owner mismatch. Expected: {}, Got: {}", 
             seller_account.key, seller_token_info.owner);
        return Err(ProgramError::InvalidAccountData);
    }
    msg!("✓ Token account owner correct");
    
    drop(seller_token_data);
    
    // Calculate SOL to return
    let sol_to_return = amount.checked_mul(project.token_price)
        .ok_or(UnicornFactoryError::Overflow)?;
    msg!("✓ SOL to return calculated: {}", sol_to_return);
    
    // Check project account balance
    let project_balance = project_account.lamports();
    msg!("Project account balance: {}, Need to pay: {}", project_balance, sol_to_return);
    
    if project_balance < sol_to_return {
        msg!("❌ ERROR: Project insufficient balance to pay back seller");
        return Err(UnicornFactoryError::InvalidAmount.into());
    }
    msg!("✓ Project has sufficient balance");
    
    // Prepare burn instruction
    msg!("=== PREPARING BURN INSTRUCTION ===");
    let burn_instruction = token_instruction::burn(
        token_program.key,
        seller_token_account.key,
        project_token.key,
        seller_account.key,
        &[],
        amount,
    )?;
    
    msg!("Burn instruction created:");
    msg!("  - Program ID: {}", burn_instruction.program_id);
    msg!("  - Accounts count: {}", burn_instruction.accounts.len());
    for (i, acc) in burn_instruction.accounts.iter().enumerate() {
        msg!("    Account {}: pubkey={}, is_signer={}, is_writable={}", 
             i, acc.pubkey, acc.is_signer, acc.is_writable);
    }
    msg!("  - Data length: {}", burn_instruction.data.len());
    
    msg!("=== EXECUTING BURN ===");
    invoke(
        &burn_instruction,
        &[
            seller_token_account.clone(),
            project_token.clone(),
            seller_account.clone(),
        ],
    )?;
    msg!("✓ Tokens burned successfully");
    
    // Manual lamport transfer (required for accounts with data)
    msg!("=== EXECUTING MANUAL LAMPORT TRANSFER ===");
    msg!("Transferring {} lamports from project to seller", sol_to_return);
    
    // Check if project has enough lamports
    let project_lamports = project_account.lamports();
    if project_lamports < sol_to_return {
        msg!("❌ ERROR: Project insufficient balance to pay back seller");
        return Err(UnicornFactoryError::InvalidAmount.into());
    }
    msg!("✓ Project has sufficient balance: {}", project_lamports);
    
    // Perform manual lamport transfer
    **project_account.lamports.borrow_mut() -= sol_to_return;
    **seller_account.lamports.borrow_mut() += sol_to_return;
    msg!("✓ Transferred {} lamports manually", sol_to_return);
    
    // Update project state
    msg!("=== UPDATING PROJECT STATE ===");
    project.total_raised = project.total_raised
        .checked_sub(sol_to_return)
        .ok_or(UnicornFactoryError::Overflow)?;
    project.token_price = calculate_new_price(project.total_raised, project.funding_goal);
    msg!("Updated project state: total_raised={}, token_price={}", 
         project.total_raised, project.token_price);
    
    if project.total_raised >= project.funding_goal {
        project.is_active = false;
        msg!("Project funding goal reached, marking as inactive");
    }
    
    // Pack updated project data
    let mut project_data = vec![0; Project::LEN];
    project.pack(&mut project_data);
    project_account.data.borrow_mut().copy_from_slice(&project_data);
    
    msg!("✓ Project data updated");
    msg!("=== SELL TOKENS SUCCESSFUL ===");
    Ok(())
}