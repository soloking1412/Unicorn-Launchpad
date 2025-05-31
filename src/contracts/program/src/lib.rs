use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
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
}

impl Project {
    pub const LEN: usize = 32 + // authority
        32 + // name
        8 + // symbol
        8 + // funding_goal
        8 + // total_raised
        8 + // token_price
        1 + // is_active
        1; // bump

    pub fn pack(&self, dst: &mut [u8]) {
        let mut offset = 0;
        
        // Pack authority
        dst[offset..offset + 32].copy_from_slice(&self.authority.to_bytes());
        offset += 32;
        
        // Pack name
        let name_bytes = self.name.as_bytes();
        dst[offset..offset + name_bytes.len()].copy_from_slice(name_bytes);
        offset += 32;
        
        // Pack symbol
        let symbol_bytes = self.symbol.as_bytes();
        dst[offset..offset + symbol_bytes.len()].copy_from_slice(symbol_bytes);
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
    }

    pub fn unpack(src: &[u8]) -> Result<Self, ProgramError> {
        let mut offset = 0;
        
        // Unpack authority
        let authority = Pubkey::try_from(&src[offset..offset + 32])
            .map_err(|_| ProgramError::InvalidAccountData)?;
        offset += 32;
        
        // Unpack name
        let name = String::from_utf8(src[offset..offset + 32].to_vec())
            .map_err(|_| ProgramError::InvalidAccountData)?;
        offset += 32;
        
        // Unpack symbol
        let symbol = String::from_utf8(src[offset..offset + 8].to_vec())
            .map_err(|_| ProgramError::InvalidAccountData)?;
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
        
        Ok(Project {
            authority,
            name,
            symbol,
            funding_goal,
            total_raised,
            token_price,
            is_active,
            bump,
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
    let account_info_iter = &mut accounts.iter();
    let project_account = next_account_info(account_info_iter)?;
    let authority_account = next_account_info(account_info_iter)?;
    let _system_program = next_account_info(account_info_iter)?;
    
    // Verify authority is signer
    if !authority_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Find PDA bump
    let (pda, bump) = Pubkey::find_program_address(
        &[b"project", authority_account.key.as_ref()],
        program_id,
    );

    // Verify PDA matches
    if pda != *project_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Create project account
    let project = Project {
        authority: *authority_account.key,
        name,
        symbol,
        funding_goal,
        total_raised: 0,
        token_price: 1,
        is_active: true,
        bump,
    };
    
    // Calculate account size and rent
    let rent = Rent::get()?;
    let space = Project::LEN;
    let lamports = rent.minimum_balance(space);
    
    // Create account with PDA as signer
    let seeds = &[
        b"project".as_ref(),
        authority_account.key.as_ref(),
        &[bump],
    ];
    
    // Create the account using invoke_signed
    invoke_signed(
        &system_instruction::create_account(
            authority_account.key,
            project_account.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[authority_account.clone(), project_account.clone()],
        &[seeds],
    )?;
    
    // Pack project data
    let mut project_data = vec![0; Project::LEN];
    project.pack(&mut project_data);
    project_account.data.borrow_mut().copy_from_slice(&project_data);
    
    Ok(())
}

// Contribute instruction processor
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
    
    // Mint tokens to contributor
    let seeds = &[
        b"project".as_ref(),
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
