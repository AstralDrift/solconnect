# Issue: Implement Message Read Receipts

## Description
Users should be able to see when their messages have been read by the recipient. This feature requires updates to the message protocol, mobile application UI, and potentially the relay server to handle read receipt acknowledgments.

## Acceptance Criteria
- A new message type or field in the existing `ChatMessage` protocol to indicate a read receipt.
- The mobile application should send a read receipt when a message is viewed by the user.
- The mobile application UI should display a visual indicator (e.g., double checkmark, "Read" status) next to messages that have been read by the recipient.
