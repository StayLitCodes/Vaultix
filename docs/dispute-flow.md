# Dispute & Resolution Flow

This document details the dispute and resolution process in the Vaultix mobile application.

## Raising a Dispute
If there is a conflict in an escrow (e.g. non-delivery, poor quality), either the depositor or recipient can raise a dispute.

**Actions:**
1. User navigates to the Escrow Detail screen.
2. User taps **Raise Dispute**.
3. A modal appears warning the user: "Opening a dispute pauses escrow actions."
4. User provides a **Reason** and **Description**.

## Effects of a Dispute
Once a dispute is raised, the escrow is frozen. The following actions are **disabled**:
- Releasing milestones
- Approving deliveries
- Canceling the escrow

## Resolution
The dispute enters the `OPEN` or `UNDER_REVIEW` state. An administrator or arbitrator will review the details and make a decision.

When the dispute is resolved, the status changes to `RESOLVED` (or `REJECTED` if invalid).
A **Resolution Summary** is shown on the Escrow Detail screen detailing:
- The Admin's decision
- The designated Winner
- Final Payouts for both parties
