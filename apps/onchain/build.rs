// build.rs — Injects the VAULTIX_BUILD_COMMIT env var as a compile-time cfg.
// CI sets VAULTIX_BUILD_COMMIT=${{ github.sha }}; local builds get "dev".

fn main() {
    let commit = std::env::var("VAULTIX_BUILD_COMMIT").unwrap_or_else(|_| "dev".to_string());
    println!("cargo:rustc-env=VAULTIX_BUILD_COMMIT={commit}");
    // Re-run only when the env var changes (not on every source edit).
    println!("cargo:rerun-if-env-changed=VAULTIX_BUILD_COMMIT");
}
