//! FFI bindings for the SolChat SDK.
//!
//! This module provides a C-compatible foreign function interface (FFI)
//! for the core functionality of the SolChat SDK. It is intended to be
//! used by mobile clients (iOS, Android) to interact with the Rust core.

use std::ffi::CString;
use std::os::raw::c_char;

/// A placeholder function to verify the FFI is working.
#[no_mangle]
pub extern "C" fn solchat_sdk_version() -> *mut c_char {
    let version = CString::new("0.1.0-manual-ffi").unwrap();
    version.into_raw()
}

/// Frees a C string that was allocated by the Rust library.
#[no_mangle]
pub extern "C" fn solchat_sdk_free_string(s: *mut c_char) {
    if s.is_null() {
        return;
    }
    unsafe {
        let _ = CString::from_raw(s);
    }
} 