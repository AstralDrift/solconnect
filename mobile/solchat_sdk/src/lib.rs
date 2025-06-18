pub mod ffi;

// This can be expanded with the actual SDK logic, for now it's a placeholder.
pub struct SolChatSdk {}

impl SolChatSdk {
    pub fn new() -> Self {
        Self {}
    }

    pub fn version() -> String {
        "0.1.0".to_string()
    }
} 