'use strict';

/**
 * Fabric Gateway sidecar.
 *
 * Django's Celery worker POSTs custody-event hashes here; this service submits
 * them to the GoldTrace chaincode via the Hyperledger Fabric Gateway. Keeping
 * Fabric's SDK in a small Node service decouples it from the Python backend.
 *
 * Required env (paths to MSP crypto material from your Fabric network):
 *   PEER_ENDPOINT, PEER_HOST_ALIAS, MSP_ID, CHANNEL, CHAINCODE,
 *   CERT_PATH, KEY_PATH, TLS_CERT_PATH
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');

const cfg = {
  peerEndpoint: process.env.PEER_ENDPOINT || 'localhost:7051',
  peerHostAlias: process.env.PEER_HOST_ALIAS || 'peer0.org1.example.com',
  mspId: process.env.MSP_ID || 'Org1MSP',
  channel: process.env.CHANNEL || 'goldtrace-channel',
  chaincode: process.env.CHAINCODE || 'goldtrace',
  certPath: process.env.CERT_PATH,
  keyPath: process.env.KEY_PATH,
  tlsCertPath: process.env.TLS_CERT_PATH,
  port: process.env.PORT || 4000,
};

async function newGateway() {
  const tlsCredentials = grpc.credentials.createSsl(fs.readFileSync(cfg.tlsCertPath));
  const client = new grpc.Client(cfg.peerEndpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': cfg.peerHostAlias,
  });
  const identity = { mspId: cfg.mspId, credentials: fs.readFileSync(cfg.certPath) };
  const privateKey = crypto.createPrivateKey(fs.readFileSync(cfg.keyPath));
  const signer = signers.newPrivateKeySigner(privateKey);
  return connect({ client, identity, signer });
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ service: 'fabric-gateway', status: 'ok' }));

app.post('/anchor', async (req, res) => {
  const { eventId, batchCode, eventHash, previousHash = '', eventType = '', timestamp = '' } = req.body || {};
  if (!eventId || !batchCode || !eventHash) {
    return res.status(400).json({ error: 'eventId, batchCode and eventHash are required' });
  }
  try {
    const gateway = await newGateway();
    try {
      const contract = gateway.getNetwork(cfg.channel).getContract(cfg.chaincode);
      const resultBytes = await contract.submitTransaction(
        'AnchorEvent', eventId, batchCode, eventHash, previousHash, eventType, String(timestamp));
      res.json(JSON.parse(Buffer.from(resultBytes).toString()));
    } finally {
      gateway.close();
    }
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

app.get('/events/:batchCode', async (req, res) => {
  try {
    const gateway = await newGateway();
    try {
      const contract = gateway.getNetwork(cfg.channel).getContract(cfg.chaincode);
      const bytes = await contract.evaluateTransaction('GetBatchHistory', req.params.batchCode);
      res.json(JSON.parse(Buffer.from(bytes).toString()));
    } finally {
      gateway.close();
    }
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

app.listen(cfg.port, () => console.log(`Fabric gateway listening on :${cfg.port}`));
