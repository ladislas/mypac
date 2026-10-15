# uv command guidance

The extension wraps Pi's `bash` tool with two layers:

- PATH shims reject `pip`, `pip3`, and `poetry`, and route bare `python`/`python3`
  through uv. Python shims reject interpreter module options for `pip`, `venv`,
  and `py_compile`, not matching words in `-c` source or script/module arguments.
- Before spawning Bash, the packaged Tree-sitter Bash WASM grammar identifies
  command nodes. Static executable names (including explicit paths such as
  `.venv/bin/python3.14`) receive the same guidance. This closes the ordinary
  explicit-path gap without interpreting raw shell text as executable code.

## Supported interception

Static commands in lists, multiline commands, pipelines, conditional lists,
subshells, and command/process substitutions are inspected. Quoted executable
names and module names, static word concatenation, escaped characters, and
backslash-newline continuations are supported. Python module options support
`-m MODULE` and `-mMODULE`, with separate preceding interpreter options (including
values for `-W`, `-X`, and `--check-hash-based-pycs`). Inspection stops at `-c`,
stdin/script selection, `--`, or another module's arguments.

Quoted arguments, comments, and literal heredoc bodies are data, not commands.
Both quoted/unquoted heredoc delimiters and `<<-` tab stripping are supported.
Command substitutions in **unquoted** heredocs are executable and inspected;
quoted heredocs keep those substitutions literal.

Unparseable or unsupported Bash syntax is rejected with a syntax-inspection
error rather than falling back to the unsafe raw-text regex or silently running
uninspected code. In particular, the current upstream grammar does not support
multiple heredoc redirections attached to the same command; use separate
commands instead. The extension does not rewrite the submitted script.

## Limits

This is workflow guidance, **not a security sandbox**. Static inspection does
not evaluate variables, parameter/tilde/glob expansions, ANSI-C quoted words,
aliases, or dynamically constructed executable/module names. It does not inspect
code passed to `eval`, nested `bash -c`, `source`, external scripts, or wrapper
arguments such as `env /explicit/path/python -m pip`. Bundled Python option
clusters such as `-Impip` are outside static module-option recognition. PATH
shims still apply when those forms ultimately resolve a bare intercepted name,
but explicit paths or PATH changes can bypass them. Other Python executable
names (such as `python2` or `pypy`) and tools other than Pi's wrapped `bash` are
outside this boundary.

Disable the uv extension through `pi config` when a workflow needs unsupported
syntax or intentionally different Python tooling.
