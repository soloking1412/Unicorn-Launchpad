use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    system_instruction, system_program,
    sysvar::{clock::Clock, rent::Rent, Sysvar},
};
use spl_token::instruction as token_instruction;
use std::str::FromStr;

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
    CreateProposal {
        title: String,
        description: String,
        milestone_id: u8,
    },
    Vote {
        proposal_id: u64,
        vote: bool,
    },
    ReleaseFunds {
        proposal_id: u64,
    },
    AddMilestone {
        title: String,
        description: String,
        amount: u64,
    },
    CompleteMilestone {
        milestone_id: u8,
    },
}

impl UnicornFactoryInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        if input.is_empty() {
            return Err(ProgramError::InvalidInstructionData);
        }

        let (tag, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;

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
                let symbol =
                    String::from_utf8(rest[8 + name_len..8 + name_len + symbol_len].to_vec())
                        .map_err(|_| ProgramError::InvalidInstructionData)?;
                let funding_goal = u64::from_le_bytes(
                    rest[8 + name_len + symbol_len..8 + name_len + symbol_len + 8]
                        .try_into()
                        .unwrap(),
                );

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
            4 => {
                if rest.len() < 8 {
                    return Err(ProgramError::InvalidInstructionData);
                }
                let title_len = u32::from_le_bytes(rest[0..4].try_into().unwrap()) as usize;
                let description_len = u32::from_le_bytes(rest[4..8].try_into().unwrap()) as usize;

                if rest.len() < 8 + title_len + description_len + 1 {
                    return Err(ProgramError::InvalidInstructionData);
                }

                let title = String::from_utf8(rest[8..8 + title_len].to_vec())
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                let description = String::from_utf8(
                    rest[8 + title_len..8 + title_len + description_len].to_vec(),
                ).map_err(|_| ProgramError::InvalidInstructionData)?;
                let milestone_id = rest[8 + title_len + description_len];

                Ok(UnicornFactoryInstruction::CreateProposal {
                    title,
                    description,
                    milestone_id,
                })
            }
            5 => {
                if rest.len() < 9 {
                    return Err(ProgramError::InvalidInstructionData);
                }
                let proposal_id = u64::from_le_bytes(rest[0..8].try_into().unwrap());
                let vote = rest[8] != 0;
                Ok(UnicornFactoryInstruction::Vote { proposal_id, vote })
            }
            6 => {
                if rest.len() < 8 {
                    return Err(ProgramError::InvalidInstructionData);
                }
                let proposal_id = u64::from_le_bytes(rest[0..8].try_into().unwrap());
                Ok(UnicornFactoryInstruction::ReleaseFunds { proposal_id })
            }
            7 => {
                if rest.len() < 32 {
                    return Err(ProgramError::InvalidInstructionData);
                }
                let title_len = u32::from_le_bytes(rest[0..4].try_into().unwrap()) as usize;
                let description_len = u32::from_le_bytes(rest[4..8].try_into().unwrap()) as usize;

                if rest.len() < 32 + title_len + description_len + 8 {
                    return Err(ProgramError::InvalidInstructionData);
                }

                let title = String::from_utf8(rest[32..32 + title_len].to_vec())
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                let description = String::from_utf8(
                    rest[32 + title_len..32 + title_len + description_len].to_vec(),
                ).map_err(|_| ProgramError::InvalidInstructionData)?;
                let amount = u64::from_le_bytes(
                    rest[32 + title_len + description_len..32 + title_len + description_len + 8]
                        .try_into()
                        .unwrap(),
                );

                Ok(UnicornFactoryInstruction::AddMilestone {
                    title,
                    description,
                    amount,
                })
            }
            8 => {
                if rest.len() < 1 {
                    return Err(ProgramError::InvalidInstructionData);
                }
                let milestone_id = rest[0];
                Ok(UnicornFactoryInstruction::CompleteMilestone { milestone_id })
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
    pub milestone_count: u8,
    pub proposal_count: u8,
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
        32 + // token_mint
        1 + // milestone_count
        1; // proposal_count

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
        offset += 32;

        // Pack milestone_count
        dst[offset] = self.milestone_count;
        offset += 1;

        // Pack proposal_count
        dst[offset] = self.proposal_count;
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
        offset += 32;

        // Unpack milestone_count
        let milestone_count = src[offset];
        offset += 1;

        // Unpack proposal_count
        let proposal_count = src[offset];

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
            milestone_count,
            proposal_count,
        })
    }
}

// Proposal account structure
#[derive(Debug)]
pub struct Proposal {
    pub creator: Pubkey,
    pub title: String,
    pub description: String,
    pub milestone_id: u8,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub is_executed: bool,
    pub created_at: i64,
    pub voting_end: i64,
}

impl Proposal {
    pub const LEN: usize = 32 + // creator
        32 + // title
        256 + // description
        1 + // milestone_id
        8 + // yes_votes
        8 + // no_votes
        1 + // is_executed
        8 + // created_at
        8; // voting_end

    pub fn pack(&self, dst: &mut [u8]) {
        let mut offset = 0;

        // Pack creator
        dst[offset..offset + 32].copy_from_slice(&self.creator.to_bytes());
        offset += 32;

        // Pack title
        let title_bytes = self.title.as_bytes();
        let mut title_buffer = [0u8; 32];
        let len = std::cmp::min(title_bytes.len(), 32);
        title_buffer[..len].copy_from_slice(&title_bytes[..len]);
        dst[offset..offset + 32].copy_from_slice(&title_buffer);
        offset += 32;

        // Pack description
        let desc_bytes = self.description.as_bytes();
        let mut desc_buffer = [0u8; 256];
        let len = std::cmp::min(desc_bytes.len(), 256);
        desc_buffer[..len].copy_from_slice(&desc_bytes[..len]);
        dst[offset..offset + 256].copy_from_slice(&desc_buffer);
        offset += 256;

        // Pack milestone_id
        dst[offset] = self.milestone_id;
        offset += 1;

        // Pack yes_votes
        dst[offset..offset + 8].copy_from_slice(&self.yes_votes.to_le_bytes());
        offset += 8;

        // Pack no_votes
        dst[offset..offset + 8].copy_from_slice(&self.no_votes.to_le_bytes());
        offset += 8;

        // Pack is_executed
        dst[offset] = self.is_executed as u8;
        offset += 1;

        // Pack created_at
        dst[offset..offset + 8].copy_from_slice(&self.created_at.to_le_bytes());
        offset += 8;

        // Pack voting_end
        dst[offset..offset + 8].copy_from_slice(&self.voting_end.to_le_bytes());
    }

    pub fn unpack(src: &[u8]) -> Result<Self, ProgramError> {
        let mut offset = 0;

        // Unpack creator
        let creator = Pubkey::try_from(&src[offset..offset + 32])
            .map_err(|_| ProgramError::InvalidAccountData)?;
        offset += 32;

        // Unpack title
        let title = String::from_utf8(src[offset..offset + 32].to_vec())
            .map_err(|_| ProgramError::InvalidAccountData)?
            .trim_end_matches('\0')
            .to_string();
        offset += 32;

        // Unpack description
        let description = String::from_utf8(src[offset..offset + 256].to_vec())
            .map_err(|_| ProgramError::InvalidAccountData)?
            .trim_end_matches('\0')
            .to_string();
        offset += 256;

        // Unpack milestone_id
        let milestone_id = src[offset];
        offset += 1;

        // Unpack yes_votes
        let yes_votes = u64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
        offset += 8;

        // Unpack no_votes
        let no_votes = u64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
        offset += 8;

        // Unpack is_executed
        let is_executed = src[offset] != 0;
        offset += 1;

        // Unpack created_at
        let created_at = i64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
        offset += 8;

        // Unpack voting_end
        let voting_end = i64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());

        Ok(Proposal {
            creator,
            title,
            description,
            milestone_id,
            yes_votes,
            no_votes,
            is_executed,
            created_at,
            voting_end,
        })
    }
}

#[derive(Debug)]
pub struct Milestone {
    pub title: String,
    pub description: String,
    pub amount: u64,
    pub is_completed: bool,
    pub completed_at: i64,
    pub has_proposal: bool,
}

impl Milestone {
    pub const LEN: usize = 32 + // title
        256 + // description
        8 + // amount
        1 + // is_completed
        8 + // completed_at
        1; // has_proposal

    pub fn pack(&self, dst: &mut [u8]) {
        let mut offset = 0;

        // Pack title
        let title_bytes = self.title.as_bytes();
        let mut title_buffer = [0u8; 32];
        let len = std::cmp::min(title_bytes.len(), 32);
        title_buffer[..len].copy_from_slice(&title_bytes[..len]);
        dst[offset..offset + 32].copy_from_slice(&title_buffer);
        offset += 32;

        // Pack description
        let desc_bytes = self.description.as_bytes();
        let mut desc_buffer = [0u8; 256];
        let len = std::cmp::min(desc_bytes.len(), 256);
        desc_buffer[..len].copy_from_slice(&desc_bytes[..len]);
        dst[offset..offset + 256].copy_from_slice(&desc_buffer);
        offset += 256;

        // Pack amount
        dst[offset..offset + 8].copy_from_slice(&self.amount.to_le_bytes());
        offset += 8;

        // Pack is_completed
        dst[offset] = self.is_completed as u8;
        offset += 1;

        // Pack completed_at
        dst[offset..offset + 8].copy_from_slice(&self.completed_at.to_le_bytes());
        offset += 8;

        // Pack has_proposal
        dst[offset] = self.has_proposal as u8;
    }

    pub fn unpack(src: &[u8]) -> Result<Self, ProgramError> {
        let mut offset = 0;

        // Unpack title
        let title = String::from_utf8(src[offset..offset + 32].to_vec())
            .map_err(|_| ProgramError::InvalidAccountData)?
            .trim_end_matches('\0')
            .to_string();
        offset += 32;

        // Unpack description
        let description = String::from_utf8(src[offset..offset + 256].to_vec())
            .map_err(|_| ProgramError::InvalidAccountData)?
            .trim_end_matches('\0')
            .to_string();
        offset += 256;

        // Unpack amount
        let amount = u64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
        offset += 8;

        // Unpack is_completed
        let is_completed = src[offset] != 0;
        offset += 1;

        // Unpack completed_at
        let completed_at = i64::from_le_bytes(src[offset..offset + 8].try_into().unwrap());
        offset += 8;

        // Unpack has_proposal
        let has_proposal = src[offset] != 0;

        Ok(Milestone {
            title,
            description,
            amount,
            is_completed,
            completed_at,
            has_proposal,
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
    ProposalNotFound,
    ProposalAlreadyExecuted,
    VotingPeriodEnded,
    AlreadyVoted,
    InvalidMilestone,
    MilestoneAlreadyCompleted,
    VotingPeriodNotEnded,
    ProposalDidNotPass,
    MilestoneAlreadyHasProposal,
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
        UnicornFactoryInstruction::CreateProposal {
            title,
            description,
            milestone_id,
        } => {
            msg!("Instruction: Create Proposal");
            process_create_proposal(
                program_id,
                accounts,
                title,
                description,
                milestone_id,
            )
        }
        UnicornFactoryInstruction::Vote { proposal_id, vote } => {
            msg!("Instruction: Vote");
            process_vote(program_id, accounts, proposal_id, vote)
        }
        UnicornFactoryInstruction::ReleaseFunds { proposal_id } => {
            msg!("Instruction: Release Funds");
            process_release_funds(program_id, accounts, proposal_id)
        }
        UnicornFactoryInstruction::AddMilestone {
            title,
            description,
            amount,
        } => {
            msg!("Instruction: Add Milestone");
            process_add_milestone(program_id, accounts, title, description, amount)
        }
        UnicornFactoryInstruction::CompleteMilestone { milestone_id } => {
            msg!("Instruction: Complete Milestone");
            process_complete_milestone(program_id, accounts, milestone_id)
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
    msg!(
        "Processing account 0: Project Account key: {}",
        project_account.key
    );

    let authority_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 1: Authority Account key: {}",
        authority_account.key
    );

    let system_program = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 2: System Program key: {}",
        system_program.key
    );

    let token_program = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 3: Token Program key: {}",
        token_program.key
    );

    let token_mint_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 4: Token Mint Account key: {}",
        token_mint_account.key
    );

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
    let (pda, bump) =
        Pubkey::find_program_address(&[b"project", authority_account.key.as_ref()], program_id);

    msg!("Generated PDA: {}", pda);
    msg!("Bump: {}", bump);

    // Verify PDA matches
    if pda != *project_account.key {
        msg!(
            "Invalid project account. Expected: {}, Got: {}",
            pda,
            project_account.key
        );
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
        milestone_count: 0,
        proposal_count: 0,
    };

    msg!(
        "Project data prepared: name={}, symbol={}, funding_goal={}, token_mint={}",
        name,
        symbol,
        funding_goal,
        project.token_mint
    );

    // Calculate account size and rent
    let rent = Rent::get()?;
    let space = Project::LEN;
    let lamports = rent.minimum_balance(space);

    msg!("Account space: {}, Lamports: {}", space, lamports);

    // Create account with PDA as signer
    let seeds = &[b"project".as_ref(), authority_account.key.as_ref(), &[bump]];

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
        &[
            authority_account.clone(),
            project_account.clone(),
            system_program.clone(),
        ],
        &[seeds],
    )?;

    msg!("Account created successfully");

    // Pack project data
    let mut project_data = vec![0; Project::LEN];
    project.pack(&mut project_data);
    project_account
        .data
        .borrow_mut()
        .copy_from_slice(&project_data);

    msg!("Project initialized successfully");
    Ok(())
}

// Contribute instruction processor
fn process_contribute(accounts: &[AccountInfo], amount: u64) -> ProgramResult {
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
        &system_instruction::transfer(contributor_account.key, project_account.key, amount),
        &[contributor_account.clone(), project_account.clone()],
    )?;

    // Mint tokens to contributor
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
    project.total_raised = project
        .total_raised
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
    project_account
        .data
        .borrow_mut()
        .copy_from_slice(&project_data);

    Ok(())
}

// Buy tokens instruction processor
fn process_buy_tokens(accounts: &[AccountInfo], amount: u64) -> ProgramResult {
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
        &system_instruction::transfer(buyer_account.key, project_account.key, amount),
        &[buyer_account.clone(), project_account.clone()],
    )?;

    // Mint tokens to buyer
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
    project.total_raised = project
        .total_raised
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
    project_account
        .data
        .borrow_mut()
        .copy_from_slice(&project_data);

    Ok(())
}

// Sell tokens instruction processor
fn process_sell_tokens(accounts: &[AccountInfo], amount: u64) -> ProgramResult {
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
    msg!(
        "✓ Seller token account loaded: {}",
        seller_token_account.key
    );

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
        msg!(
            "❌ ERROR: Invalid token program. Expected: {}, Got: {}",
            spl_token::id(),
            token_program.key
        );
        return Err(ProgramError::IncorrectProgramId);
    }
    msg!("✓ Token program ID correct");

    // Verify system program ID
    if system_program.key != &system_program::id() {
        msg!(
            "❌ ERROR: Invalid system program. Expected: {}, Got: {}",
            system_program::id(),
            system_program.key
        );
        return Err(ProgramError::IncorrectProgramId);
    }
    msg!("✓ System program ID correct");

    // Load and verify project
    msg!("=== PROJECT LOADING ===");
    let project_data = project_account.data.borrow();
    let mut project = Project::unpack(&project_data)?;
    msg!(
        "✓ Project loaded: name={}, authority={}, total_raised={}, token_price={}, token_mint={}",
        project.name,
        project.authority,
        project.total_raised,
        project.token_price,
        project.token_mint
    );

    drop(project_data);

    if !project.is_active {
        msg!("❌ ERROR: Project is not active");
        return Err(UnicornFactoryError::ProjectNotActive.into());
    }
    msg!("✓ Project is active");

    // Verify project token mint matches
    if project.token_mint != *project_token.key {
        msg!(
            "❌ ERROR: Project token mint mismatch. Project mint: {}, Provided mint: {}",
            project.token_mint,
            project_token.key
        );
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
        msg!(
            "❌ ERROR: Seller token account owner mismatch. Expected: {}, Got: {}",
            spl_token::id(),
            seller_token_account.owner
        );
        return Err(ProgramError::IncorrectProgramId);
    }
    msg!("✓ Seller token account owned by token program");

    // Parse seller token account data
    let seller_token_data = seller_token_account.try_borrow_data()?;
    if seller_token_data.len() != spl_token::state::Account::LEN {
        msg!(
            "❌ ERROR: Invalid token account data length. Expected: {}, Got: {}",
            spl_token::state::Account::LEN,
            seller_token_data.len()
        );
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
        msg!(
            "❌ ERROR: Insufficient token balance. Has: {}, Needs: {}",
            seller_token_info.amount,
            amount
        );
        return Err(UnicornFactoryError::InvalidAmount.into());
    }
    msg!("✓ Sufficient token balance");

    if seller_token_info.mint != *project_token.key {
        msg!(
            "❌ ERROR: Token account mint mismatch. Expected: {}, Got: {}",
            project_token.key,
            seller_token_info.mint
        );
        return Err(ProgramError::InvalidAccountData);
    }
    msg!("✓ Token account mint correct");

    if seller_token_info.owner != *seller_account.key {
        msg!(
            "❌ ERROR: Token account owner mismatch. Expected: {}, Got: {}",
            seller_account.key,
            seller_token_info.owner
        );
        return Err(ProgramError::InvalidAccountData);
    }
    msg!("✓ Token account owner correct");

    drop(seller_token_data);

    // Calculate SOL to return
    let sol_to_return = amount
        .checked_mul(project.token_price)
        .ok_or(UnicornFactoryError::Overflow)?;
    msg!("✓ SOL to return calculated: {}", sol_to_return);

    // Check project account balance
    let project_balance = project_account.lamports();
    msg!(
        "Project account balance: {}, Need to pay: {}",
        project_balance,
        sol_to_return
    );

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
        msg!(
            "    Account {}: pubkey={}, is_signer={}, is_writable={}",
            i,
            acc.pubkey,
            acc.is_signer,
            acc.is_writable
        );
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
    msg!(
        "Transferring {} lamports from project to seller",
        sol_to_return
    );

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
    project.total_raised = project
        .total_raised
        .checked_sub(sol_to_return)
        .ok_or(UnicornFactoryError::Overflow)?;
    project.token_price = calculate_new_price(project.total_raised, project.funding_goal);
    msg!(
        "Updated project state: total_raised={}, token_price={}",
        project.total_raised,
        project.token_price
    );

    if project.total_raised >= project.funding_goal {
        project.is_active = false;
        msg!("Project funding goal reached, marking as inactive");
    }

    // Pack updated project data
    let mut project_data = vec![0; Project::LEN];
    project.pack(&mut project_data);
    project_account
        .data
        .borrow_mut()
        .copy_from_slice(&project_data);

    msg!("✓ Project data updated");
    msg!("=== SELL TOKENS SUCCESSFUL ===");
    Ok(())
}

// Create proposal instruction processor
fn process_create_proposal(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    description: String,
    milestone_id: u8,
) -> ProgramResult {
    msg!("Starting proposal creation");
    let account_info_iter = &mut accounts.iter();

    let project_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 0: Project Account key: {}",
        project_account.key
    );

    let proposal_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 1: Proposal Account key: {}",
        proposal_account.key
    );

    let authority_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 2: Authority Account key: {}",
        authority_account.key
    );

    let milestone_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 3: Milestone Account key: {}",
        milestone_account.key
    );

    let system_program = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 4: System Program key: {}",
        system_program.key
    );

    // Verify system program
    if system_program.key != &system_program::id() {
        msg!("Invalid system program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load and verify project
    let mut project_data = project_account.data.borrow_mut();
    let mut project = Project::unpack(&project_data)?;

    // Verify authority is project authority and is signer
    if !authority_account.is_signer || authority_account.key != &project.authority {
        msg!("Invalid authority or authority is not signer");
        return Err(UnicornFactoryError::InvalidAuthority.into());
    }

    // Load and verify milestone
    let mut milestone_data = milestone_account.data.borrow_mut();
    let mut milestone = Milestone::unpack(&milestone_data)?;

    // Verify milestone PDA
    let (expected_milestone_pda, _milestone_bump) = Pubkey::find_program_address(
        &[b"milestone", project_account.key.as_ref(), &[milestone_id]],
        program_id,
    );

    if expected_milestone_pda != *milestone_account.key {
        msg!(
            "Invalid milestone account PDA. Expected: {}, Got: {}",
            expected_milestone_pda,
            milestone_account.key
        );
        return Err(ProgramError::IncorrectProgramId);
    }

    // Check if milestone already has a proposal
    if milestone.has_proposal {
        msg!("Milestone {} already has a proposal", milestone_id);
        return Err(UnicornFactoryError::MilestoneAlreadyHasProposal.into());
    }

    // Determine the index for the new proposal
    let proposal_index = project.proposal_count;
    msg!("New proposal index: {}", proposal_index);

    // Find Proposal PDA and bump
    let (expected_proposal_pda, proposal_bump) = Pubkey::find_program_address(
        &[b"proposal", project_account.key.as_ref(), &[proposal_index]],
        program_id,
    );

    // Verify the provided proposal account is the expected PDA
    if expected_proposal_pda != *proposal_account.key {
        msg!(
            "Invalid proposal account PDA. Expected: {}, Got: {}",
            expected_proposal_pda,
            proposal_account.key
        );
        return Err(ProgramError::IncorrectProgramId);
    }

    // Verify proposal account is not already initialized
    if proposal_account.data.borrow().iter().any(|&x| x != 0) {
        msg!("Proposal account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Calculate account size and rent
    let rent = Rent::get()?;
    let space = Proposal::LEN;
    let lamports = rent.minimum_balance(space);

    msg!("Proposal account space: {}, Lamports: {}", space, lamports);

    // Create proposal account using invoke_signed
    let proposal_seeds = &[
        b"proposal".as_ref(),
        project_account.key.as_ref(),
        &[proposal_index],
        &[proposal_bump],
    ];

    invoke_signed(
        &system_instruction::create_account(
            authority_account.key,
            proposal_account.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            authority_account.clone(),
            proposal_account.clone(),
            system_program.clone(),
        ],
        &[proposal_seeds],
    )?;

    msg!("Proposal account created successfully");

    // Create proposal data
    let clock = Clock::get()?;
    let proposal = Proposal {
        creator: *authority_account.key,
        title: title.clone(),
        description: description.clone(),
        milestone_id,
        yes_votes: 0,
        no_votes: 0,
        is_executed: false,
        created_at: clock.unix_timestamp,
        voting_end: clock.unix_timestamp + 180, // 24 hours from now
    };

    // Pack proposal data into the new account
    let mut proposal_data_buffer = proposal_account.data.borrow_mut();
    proposal.pack(&mut proposal_data_buffer);
    drop(proposal_data_buffer);

    // Update milestone to indicate it has a proposal
    milestone.has_proposal = true;
    milestone.pack(&mut milestone_data);
    drop(milestone_data);

    // Increment proposal count in project account
    project.proposal_count += 1;

    // Pack updated project data
    project.pack(&mut project_data);
    drop(project_data);

    msg!("Proposal added and project count updated successfully");
    Ok(())
}

// Vote instruction processor
fn process_vote(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    proposal_id: u64,
    vote: bool,
) -> ProgramResult {
    msg!("Starting vote processing");
    let account_info_iter = &mut accounts.iter();

    let project_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 0: Project Account key: {}",
        project_account.key
    );

    let proposal_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 1: Proposal Account key: {}",
        proposal_account.key
    );

    let voter_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 2: Voter Account key: {}",
        voter_account.key
    );

    let system_program = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 3: System Program key: {}",
        system_program.key
    );

    // Verify voter is signer
    if !voter_account.is_signer {
        msg!("Voter is not a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify system program
    if system_program.key != &system_program::id() {
        msg!("Invalid system program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load and verify project
    let project_data = project_account.data.borrow();
    let project = Project::unpack(&project_data)?;
    drop(project_data);

    // Find expected Proposal PDA (using single byte like create_proposal)
    let (expected_proposal_pda, _bump) = Pubkey::find_program_address(
        &[
            b"proposal",
            project_account.key.as_ref(),
            &[proposal_id as u8],
        ],
        program_id,
    );

    // Verify the provided proposal account is the expected PDA
    if expected_proposal_pda != *proposal_account.key {
        msg!(
            "Invalid proposal account PDA. Expected: {}, Got: {}",
            expected_proposal_pda,
            proposal_account.key
        );
        return Err(ProgramError::IncorrectProgramId);
    }

    // Deserialize proposal data
    let mut proposal_data = proposal_account.try_borrow_mut_data()?;
    msg!("Proposal account data length: {}", proposal_data.len());
    let mut proposal = Proposal::unpack(&proposal_data)?;

    if proposal.is_executed {
        msg!("Proposal is already executed");
        return Err(UnicornFactoryError::ProposalAlreadyExecuted.into());
    }

    // Check if voting period has ended
    let clock = Clock::get()?;
    if clock.unix_timestamp > proposal.voting_end {
        msg!("Voting period has ended");
        return Err(UnicornFactoryError::VotingPeriodEnded.into());
    }

    // Update vote count
    if vote {
        proposal.yes_votes += 1;
    } else {
        proposal.no_votes += 1;
    }

    // Pack updated proposal data
    proposal.pack(&mut proposal_data);
    drop(proposal_data);

    msg!("Vote processed successfully");
    Ok(())
}

// Release funds instruction processor
fn process_release_funds(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    proposal_id: u64,
) -> ProgramResult {
    msg!("Starting funds release for proposal {}", proposal_id);
    let account_info_iter = &mut accounts.iter();

    let project_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 0: Project Account key: {}",
        project_account.key
    );

    let proposal_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 1: Proposal Account key: {}",
        proposal_account.key
    );

    let authority_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 2: Authority Account key: {}",
        authority_account.key
    );

    let milestone_account = next_account_info(account_info_iter)?;
     msg!(
        "Processing account 3: Milestone Account key: {}",
        milestone_account.key
    );

    let system_program = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 4: System Program key: {}",
        system_program.key
    );

    // Verify system program
    if system_program.key != &system_program::id() {
        msg!("Invalid system program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load and verify project
    let project_data = project_account.data.borrow();
    let project = Project::unpack(&project_data)?;
    
    // Store the values we need before dropping the borrow
    let project_authority = project.authority;
    let project_bump = project.bump;
    drop(project_data);

    // Verify authority is project authority and is signer
    if !authority_account.is_signer || authority_account.key != &project_authority {
        msg!("Invalid authority or authority is not signer");
        return Err(UnicornFactoryError::InvalidAuthority.into());
    }

    // Find expected Proposal PDA (using single byte like create_proposal)
    let (expected_proposal_pda, _bump) = Pubkey::find_program_address(
        &[
            b"proposal",
            project_account.key.as_ref(),
            &[proposal_id as u8],
        ],
        program_id,
    );

    // Verify the provided proposal account is the expected PDA
    if expected_proposal_pda != *proposal_account.key {
        msg!(
            "Invalid proposal account PDA. Expected: {}, Got: {}",
            expected_proposal_pda,
            proposal_account.key
        );
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load and verify proposal
    let mut proposal_data = proposal_account.data.borrow_mut();
    let mut proposal = Proposal::unpack(&proposal_data)?;

    if proposal.is_executed {
        msg!("Proposal {} is already executed", proposal_id);
        return Err(UnicornFactoryError::ProposalAlreadyExecuted.into());
    }

    // Check if voting period has ended
    let clock = Clock::get()?;
    if clock.unix_timestamp <= proposal.voting_end {
        msg!(
            "Voting period for proposal {} has not ended yet",
            proposal_id
        );
        return Err(UnicornFactoryError::VotingPeriodNotEnded.into());
    }

    // Check if proposal has won (yes votes > no votes)
    if proposal.yes_votes <= proposal.no_votes {
        msg!("Proposal {} did not win the vote", proposal_id);
        return Err(UnicornFactoryError::ProposalDidNotPass.into());
    }

     // Load and verify milestone account
    let mut milestone_data = milestone_account.data.borrow_mut();
    let mut milestone = Milestone::unpack(&milestone_data)?;

    // Verify milestone PDA using the milestone_id from the proposal
    let (expected_milestone_pda, _milestone_bump) = Pubkey::find_program_address(
        &[b"milestone", project_account.key.as_ref(), &[proposal.milestone_id]],
        program_id,
    );

     if expected_milestone_pda != *milestone_account.key {
        msg!(
            "Invalid milestone account PDA for release. Expected: {}, Got: {}",
            expected_milestone_pda,
            milestone_account.key
        );
        return Err(ProgramError::IncorrectProgramId);
    }


    // Release funds using manual lamport transfer
    let amount_to_release = milestone.amount;
    msg!(
        "Releasing {} lamports for proposal {}",
        amount_to_release,
        proposal_id
    );

    // Check if project has enough lamports
    let project_lamports = project_account.lamports();
    if project_lamports < amount_to_release {
        msg!("Project insufficient balance to pay back authority");
        return Err(UnicornFactoryError::InvalidAmount.into());
    }

    // Manual lamport transfer
    **project_account.lamports.borrow_mut() -= amount_to_release;
    **authority_account.lamports.borrow_mut() += amount_to_release;

    // Mark proposal as executed
    proposal.is_executed = true;

    msg!("Successfully released {} lamports for proposal {}", amount_to_release, proposal_id);

    // Pack updated proposal data
    proposal.pack(&mut proposal_data);
    drop(proposal_data);

    // Mark milestone as completed
    milestone.is_completed = true;
    milestone.pack(&mut milestone_data);
    drop(milestone_data);

    msg!(
        "Funds released and proposal {} marked as executed successfully",
        proposal_id
    );
    Ok(())
}

// Add milestone instruction processor
fn process_add_milestone(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    description: String,
    amount: u64,
) -> ProgramResult {
    msg!("🔧 NEW CONTRACT VERSION - USING INVOKE_SIGNED FOR MILESTONES");
    msg!("Starting milestone addition");
    let account_info_iter = &mut accounts.iter();

    let project_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 0: Project Account key: {}",
        project_account.key
    );

    let milestone_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 1: Milestone Account key: {}",
        milestone_account.key
    );

    let authority_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 2: Authority Account key: {}",
        authority_account.key
    );

    let system_program = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 3: System Program key: {}",
        system_program.key
    );

    // Verify system program
    if system_program.key != &system_program::id() {
        msg!("Invalid system program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load project and get values we need
    let project = {
        let project_data = project_account.data.borrow();
        Project::unpack(&project_data)?
    };

    let project_authority = project.authority;
    let milestone_index = project.milestone_count;

    // Verify authority is project authority and is signer
    if !authority_account.is_signer || authority_account.key != &project_authority {
        msg!("Invalid authority or authority is not signer");
        return Err(UnicornFactoryError::InvalidAuthority.into());
    }

    // Verify milestone PDA
    let (expected_milestone_pda, milestone_bump) = Pubkey::find_program_address(
        &[
            b"milestone",
            project_account.key.as_ref(),
            &[milestone_index],
        ],
        program_id,
    );

    if expected_milestone_pda != *milestone_account.key {
        msg!(
            "Invalid milestone account PDA. Expected: {}, Got: {}",
            expected_milestone_pda,
            milestone_account.key
        );
        return Err(ProgramError::IncorrectProgramId);
    }

    // Verify milestone account is not already initialized
    if milestone_account.data.borrow().iter().any(|&x| x != 0) {
        msg!("Milestone account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Calculate rent
    let rent = Rent::get()?;
    let space = Milestone::LEN;
    let lamports = rent.minimum_balance(space);

    // Create milestone account using invoke_signed
    let milestone_seeds = &[
        b"milestone".as_ref(),
        project_account.key.as_ref(),
        &[milestone_index],
        &[milestone_bump],
    ];

    invoke_signed(
        &system_instruction::create_account(
            authority_account.key,
            milestone_account.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            authority_account.clone(),
            milestone_account.clone(),
            system_program.clone(),
        ],
        &[milestone_seeds],
    )?;

    // Create and pack milestone data
    let milestone = Milestone {
        title: title.clone(),
        description: description.clone(),
        amount,
        is_completed: false,
        completed_at: 0,
        has_proposal: false,
    };

    {
        let mut milestone_data_buffer = milestone_account.data.borrow_mut();
        milestone.pack(&mut milestone_data_buffer);
    }

    // Update project milestone count
    {
        let mut project_data = project_account.data.borrow_mut();
        let mut project = Project::unpack(&project_data)?;
        project.milestone_count += 1;
        project.pack(&mut project_data);
    }

    msg!("Milestone added successfully");
    Ok(())
}

// Complete milestone instruction processor
fn process_complete_milestone(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    milestone_id: u8,
) -> ProgramResult {
    msg!("Starting milestone completion");
    let account_info_iter = &mut accounts.iter();

    let project_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 0: Project Account key: {}",
        project_account.key
    );

    let milestone_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 1: Milestone Account key: {}",
        milestone_account.key
    );

    let authority_account = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 2: Authority Account key: {}",
        authority_account.key
    );

    let system_program = next_account_info(account_info_iter)?;
    msg!(
        "Processing account 3: System Program key: {}",
        system_program.key
    );

    // Verify system program
    if system_program.key != &system_program::id() {
        msg!("Invalid system program");
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load and verify project
    let project_data = project_account.data.borrow();
    let project = Project::unpack(&project_data)?;
    drop(project_data);

    // Verify authority is project authority and is signer
    if !authority_account.is_signer || authority_account.key != &project.authority {
        msg!("Invalid authority or authority is not signer");
        return Err(UnicornFactoryError::InvalidAuthority.into());
    }

    // Find expected Milestone PDA
    let (expected_milestone_pda, _bump) = Pubkey::find_program_address(
        &[b"milestone", project_account.key.as_ref(), &[milestone_id]],
        program_id,
    );

    // Verify the provided milestone account is the expected PDA
    if expected_milestone_pda != *milestone_account.key {
        msg!(
            "Invalid milestone account PDA. Expected: {}, Got: {}",
            expected_milestone_pda,
            milestone_account.key
        );
        return Err(ProgramError::IncorrectProgramId);
    }

    // Load and verify milestone
    let mut milestone_data = milestone_account.data.borrow_mut();
    let mut milestone = Milestone::unpack(&milestone_data)?;

    if milestone.is_completed {
        msg!("Milestone is already completed");
        return Err(UnicornFactoryError::MilestoneAlreadyCompleted.into());
    }

    // Complete milestone
    msg!("Completing milestone {}", milestone_id);
    let clock = Clock::get()?;
    milestone.is_completed = true;
    milestone.completed_at = clock.unix_timestamp;

    // Pack updated milestone data
    milestone.pack(&mut milestone_data);
    drop(milestone_data);

    msg!("Milestone {} completed successfully", milestone_id);
    Ok(())
}
