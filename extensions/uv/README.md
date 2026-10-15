# uv command guidance

The extension wraps Pi's `bash` tool with two layers:

- PATH shims reject `pip`, `pip3`, and `poetry`, and route bare `python`/`python3`
  through uv. Python shims reject interpreter module options for `pip`, `venv`,
  and `py_compile`, not matching words in `-c` source or script/module arguments.
- Before spawning Bash, `sh-ast` uses the packaged mvdan/sh Bash parser via WASM
  to identify command nodes. Static executable names (including explicit paths
  such as `.venv/bin/python3.14`) receive the same guidance. This closes the
  ordinary explicit-path gap without interpreting raw shell text as executable
  code or relying on an editor parser's error-recovery tree.

## Supported interception

Static commands in lists, multiline commands, pipelines, conditional lists,
subshells, and command/process substitutions are inspected. Quoted executable
names and module names, static word concatenation, escaped characters, and
backslash-newline continuations are supported. Python module options support
`-m MODULE` and `-mMODULE`, with separate preceding interpreter options (including
values for `-W`, `-X`, and `--check-hash-based-pycs`). Inspection stops at `-c`,
stdin/script selection, `--`, or another module's arguments.

Quoted arguments, comments, and literal heredoc bodies are data, not commands.
Quoted/unquoted heredoc delimiters, `<<-` tab stripping, and **multiple heredoc
redirections on the same command** are supported. Each body remains data;
command substitutions in **unquoted** heredocs are executable and inspected,
while quoted heredocs keep those substitutions literal. Commands following the
bodies or in the surrounding pipeline still receive executable guidance.

The parser runs in its Bash dialect, including Bash-specific redirections and
compound commands. Syntax errors receive the parser's own diagnostic, not a
Python-policy rejection. There is no raw-text regex fallback or parse-error
bypass of explicit-path inspection. The extension does not rewrite the script.

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

Disable the uv extension through `pi config` when a workflow intentionally
needs different Python tooling.
