#!/usr/bin/env node
/**
 * Local Record Vault USB bridge entry.
 * Always runs in standalone mode so end-user packages need no Node/Postgres/JWT setup.
 */
process.env.RECORD_VAULT_BRIDGE_STANDALONE = '1';

const { startBridgeServer } = await import('./agentServer.js');
startBridgeServer();
