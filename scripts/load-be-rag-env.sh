#!/usr/bin/env bash
# Load RAG / Ollama keys from ~/.ssh/be/.env into the current shell (Python RAG startup).
# Node already loads this file via be/loadEnv.js — the Python service does not unless we export here.

load_be_rag_env() {
  local env_file="${BE_ENV_FILE:-$HOME/.ssh/be/.env}"
  [[ -f "$env_file" ]] || return 0
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" || "$line" != *=* ]] && continue
    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${line#*=}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%%#*}"
    val="${val%"${val##*[![:space:]]}"}"
    val="${val#\"}"
    val="${val%\"}"
    val="${val#\'}"
    val="${val%\'}"
    case "$key" in
      OLLAMA_MODEL|OLLAMA_BASE_URL|OLLAMA_KEEP_ALIVE|OLLAMA_KEEP_ALIVE_PINNED|RAG_HOST|RAG_PORT)
        export "$key=$val"
        ;;
    esac
  done <"$env_file"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  load_be_rag_env
  echo "OLLAMA_MODEL=${OLLAMA_MODEL:-"(unset)"}"
fi
