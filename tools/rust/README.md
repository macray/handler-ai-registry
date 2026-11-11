# Rust

Lets agents build, test and lint Rust projects: the stable toolchain, with `cargo`, `rustfmt`
and `clippy`, through rustup.

- **Needs**: a C compiler in the toolbox (Rust links with it): installing the tool adds the
  `gcc` system package when the toolbox lacks one.
- **Commands**: `cargo`, `rustc`, `rustdoc`, `rustfmt`, `cargo-fmt`, `cargo-clippy`,
  `clippy-driver`, `rustup`.
- **Reaches**: crates.io (index.crates.io, static.crates.io, crates.io). A git dependency or
  another registry needs its host allowed for the agent.
- **Keeps**: crates and the commands `cargo install` adds (`~/.cargo`, its `bin` on the agent's
  PATH), as your project's caches setting says.
- **Updates**: every rebuild installs the latest stable Rust. The toolchain is the tool's, and
  read-only: `rustup` shows it but cannot install another one, so a project whose
  `rust-toolchain.toml` names another toolchain (nightly, a pinned version, a target) fails
  (rustup: "Read-only file system").
- **Size**: about 640 MB.
