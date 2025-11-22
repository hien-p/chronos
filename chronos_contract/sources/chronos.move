module chronos_contract::chronos;

use std::string::String;
use sui::clock::{Self, Clock};
use sui::event;
// use sui::object::{Self, UID, ID}; // UID, ID, object are available by default?
// use sui::tx_context::{Self, TxContext}; // TxContext available by default?
// use sui::transfer; // transfer available by default?
// It seems Move 2024 includes many of these by default.
// Let's try removing them and see if it compiles.
// If not, I will add back only what's needed.
// Actually, let's keep the module imports but remove the specific types if they are default.
use sui::object;
use sui::tx_context;
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
    blob_id: String,
    sentinels: vector<address>,
}

/// Emitted when the vault is triggered and data is released.
public struct ReleaseEvent has copy, drop {
    vault_id: ID,
    recipient: address,
    blob_id: String,
    encrypted_key: vector<u8>,
}

/// Emitted when the sentinel warning is triggered.
public struct SentinelWarning has copy, drop {
    vault_id: ID,
    sentinels: vector<address>,
    message: String,
}

// === Structs ===
public struct Vault has key, store {
    id: UID,
    owner: address,
    recipient: address,
    blob_id: String, // Walrus Blob ID
    encrypted_key: vector<u8>, // Encrypted AES key / SEAL capsule
    last_heartbeat: u64,
    interval: u64,
    sentinel_interval: u64,
    sentinels: vector<address>,
}

// === Public Functions ===

/// Create a new Vault with a specified heartbeat interval and recipient.
public entry fun create_vault(
    recipient: address,
    blob_id: String,
    encrypted_key: vector<u8>,
    interval: u64,
    sentinel_interval: u64,
    sentinels: vector<address>,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let owner = tx_context::sender(ctx);
    let id = object::new(ctx);
    let vault_id = object::uid_to_inner(&id);
    
    let vault = Vault {
        id,
        owner,
        recipient,
        blob_id,
        encrypted_key,
        last_heartbeat: clock::timestamp_ms(clock),
        interval,
        sentinel_interval,
        sentinels,
    };

    event::emit(VaultCreated {
        id: vault_id,
        creator: owner,
        recipient,
        blob_id: vault.blob_id,
        sentinels: vault.sentinels,
    });

    transfer::share_object(vault);
}

/// Owner calls this to reset the timer.
public fun keep_alive(vault: &mut Vault, clock: &Clock, ctx: &mut TxContext) {
    assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
    vault.last_heartbeat = clock::timestamp_ms(clock);
}

/// Anyone can call this. If the interval has passed, it emits the ReleaseEvent.
public fun trigger_release(vault: &Vault, clock: &Clock) {
    let current_time = clock::timestamp_ms(clock);
    assert!(current_time > vault.last_heartbeat + vault.interval, ENotExpired);
    
    event::emit(ReleaseEvent {
        vault_id: object::id(vault),
        recipient: vault.recipient,
        blob_id: vault.blob_id,
        encrypted_key: vault.encrypted_key,
    });
}

/// Trigger a warning to sentinels if the sentinel interval has passed.
public fun trigger_sentinel_warning(vault: &Vault, clock: &Clock) {
    let current_time = clock::timestamp_ms(clock);
    // Check if we are in the warning zone: last_heartbeat + sentinel_interval < current_time < last_heartbeat + interval
    // Actually, we just need to check if we passed the sentinel warning time.
    // Usually sentinel_interval is "time before release", but here I implemented it as "time after heartbeat".
    // Let's stick to "time after heartbeat" for simplicity in this iteration, or "duration until warning".
    // If sentinel_interval is e.g. 25 days and interval is 30 days.
    
    assert!(current_time > vault.last_heartbeat + vault.sentinel_interval, ENotExpired);
    
    event::emit(SentinelWarning {
        vault_id: object::id(vault),
        sentinels: vault.sentinels,
        message: std::string::utf8(b"Warning: Vault is approaching expiration!"),
    });
}

/// SEAL Access Control Function
/// Checks if the vault is expired and the provided ID matches.
public entry fun seal_approve(id: vector<u8>, vault: &Vault, clock: &Clock) {
    // 1. Verify the ID matches the one stored in the vault
    assert!(vault.encrypted_key == id, ENotOwner); // Reusing ENotOwner as generic auth error or add new error
    
    // 2. Verify the vault is expired
    let current_time = clock::timestamp_ms(clock);
    assert!(current_time > vault.last_heartbeat + vault.interval, ENotExpired);
}
