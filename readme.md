Chronos is the first decentralized 'Keep-Alive' mechanism that combines Sui’s logic, Walrus’s massive storage, and SEAL’s threshold encryption to solve the 'Sovereignty Paradox'. 

We allow users to store gigabytes of sensitive data that is mathematically impossible to decrypt until the user vanishes—creating a trustless failsafe for digital inheritance, whistleblower protection, and DAO continuity.


# Problem Statement

When people pursue self-sovereignty (complete control over their own assets, data, and keys), they unintentionally create a single point of catastrophic failure: **The Human Operator.**


> If the human disappears, forgets, dies, or loses access, everything they control becomes permanently inaccessible.


* More than **$140 billion** worth of crypto assets are currently locked forever because the owners died, became incapacitated, or lost their private keys. Since no one else holds the keys, these funds become unrecoverable, creating a massive “black hole” of trapped value.

* **The "Bus Factor" in DAOs**: An ecosystem relying on an anonymous founder’s private keys faces existential risk if that founder disappears (the "Anon Dev" risk). 

* The Whistleblower’s Dilemma: People holding sensitive or dangerous truths often face a difficult situation: 
    * If they reveal the truth, they risk exposure and persecution.
    * If they keep the truth silent, there is no safe, automatic mechnism to release it if they are silenced. They must rely on a centralized third party (media, lawyer, organization), which itself can be pressured, corrupted or compromised.

-> There is no trustless, automatic data-release mechanism available today.

We already have:

* Trustless Money (Bitcoin)
* Trustless Compute (Sui, Ethereum)

But we still lack **Trustless Conditional Availability**

A system where data can be automatically released only if certain conditions are met,
without trusting any human or centralized party. 


# The Solution: "Passive Liveness" & "Threshold Release"

Chronos does not rely on lawyers or centralized servers. It introduces a **Cryptographic Heartbeat** - a mathematical way to verify that a user is still “alive” without trusting anyone.

To achieve this, Chronos separates its system into three decentralized layers:
* The Vault:  Data is not just "stored"; it is encrypted using SEAL (homomorphic/threshold) schemes and sharded across Walrus nodes. The data is public, but the meaning is invisible.

* The Pulse (Sui Smart Contracts): This layer ensures the user is still active. A `Liveness` object is created on the Sui blockchain. The user must periodically send a heartbeat transaction (a simple check-in). If the user fails to send a heartbeat for a set period, the `Liveness` object is destroyed.  ( “Are you still here?” mechanism)

* The Trigger: If the heartbeat stops, the Sui contract changes the global state. This state change authorizes the `Threshold Network` to reconstruct the decryption key and publish it to the intended recipient.











The "Anon Dev" Risk: DAOs often rely on anonymous founders holding admin keys or critical IP. If the founder rug-pulls or disappears, the project dies.

Whistleblower Dilemma: Individuals possessing sensitive data lack a trustless mechanism to ensure its release if they are silenced, without risking premature exposure.

The Gap: We have trustless money (Bitcoin) and trustless compute (Sui), but we lack trustless, conditional data release for large files.

# The Solution: "Passive Liveness"

Chronos decouples Storage, Logic, and Access.

- The Data Plane (Walrus): Stores massive, encrypted payloads (GBs/TBs) efficiently.
- The Control Plane (Sui): Manages the "Time-Lock" state, ownership capabilities (Caps), and validates heartbeats.
-The Access Plane (Oracle/Network): Holds the decryption keys in a "Pending" state, releasing them only when the Sui Contract emits a verified TRIGGER_RELEASE event.


# Use Cases (Tracks)

* Track: Trust & Security (Primary)
    * Digital Inheritance: Passing on seed phrases without giving custody to a lawyer.
    * DAO Continuity: If a founder goes silent for 30 days, admin keys are automatically rotated to a multisig of community elders.

* Track: Data
    * The "Dead Drop": Journalists or whistleblowers upload terabytes of evidence to Walrus. If they don't check in daily, the encryption key is broadcasted to the world automatically.
