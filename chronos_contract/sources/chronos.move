module chronos_contract::chronos;

use sui::clock::{Self, Clock};
use sui::event;
use sui::object::{Self, UID, ID};
use sui::tx_context::{Self, TxContext};
use sui::transfer;

// === Errors ===
const ENotOwner: u64 = 0;
const ENotExpired: u64 = 1;

// === Events ===

/// Emitted when a vault is created
public struct VaultCreated has copy, drop {
    id: ID,
    creator: address,
    recipient: address,
}

/// Emitted when the vault is triggered and data is released.
public struct ReleaseEvent has copy, drop {
    vault_id: ID,
    recipient: address,
    encrypted_data: vector<u8>,
}

// === Structs ===
public struct Vault has key, store {
    id: UID,
    owner: address,
    recipient: address,
    encrypted_data: vector<u8>, // Mock for Walrus Blob ID + Encryption Key
    last_heartbeat: u64,
    interval: u64,
}

// === Public Functions ===

/// Create a new Vault with a specified heartbeat interval and recipient.
public entry fun create_vault(
    recipient: address,
    encrypted_data: vector<u8>,
    interval: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let owner = tx_context::sender(ctx);
    let id = object::new(ctx);
    let vault_id = object::uid_to_inner(&id);
    let vault = Vault {
        id,
        owner: tx_context::sender(ctx),
        recipient,
        encrypted_data,
        last_heartbeat: clock::timestamp_ms(clock),
        interval,
    };

    event::emit(VaultCreated {
        id: vault_id,
        creator: tx_context::sender(ctx),
        recipient,
    });

    transfer::share_object(vault);
}

/// Owner calls this to reset the timer.
public entry fun keep_alive(vault: &mut Vault, clock: &Clock, ctx: &mut TxContext) {
    assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
    vault.last_heartbeat = clock::timestamp_ms(clock);
}

/// Anyone can call this. If the interval has passed, it emits the ReleaseEvent.
public entry fun trigger_release(vault: &Vault, clock: &Clock) {
    let current_time = clock::timestamp_ms(clock);
    assert!(current_time > vault.last_heartbeat + vault.interval, ENotExpired);
    
    event::emit(ReleaseEvent {
        vault_id: object::id(vault),
        recipient: vault.recipient,
        encrypted_data: vault.encrypted_data,
    });
}
