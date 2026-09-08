# GOLDTRACE — Blockchain layer (Hyperledger Fabric)

A permissioned ledger anchors the SHA-256 hash of every custody event. The
ledger holds no gold data — only hashes — so GoldBod, Customs and the Bank of
Ghana can independently verify that a batch's history was never altered.

```
blockchain/
├── chaincode/   GoldTrace smart contract (AnchorEvent, ReadEvent, GetBatchHistory, VerifyEvent)
└── gateway/     Node sidecar — Django's Celery worker POSTs hashes here to submit transactions
```

## How it fits
`production.tasks.anchor_event_to_ledger` runs on every custody event and POSTs
to the gateway's `/anchor`. The gateway submits `AnchorEvent` to the chaincode
and returns the Fabric transaction id, which is stored on the event. With
`BLOCKCHAIN_ANCHORING_ENABLED=False` (default) a stub tx-id is used so dev works
without a network.

## Deploy (Fabric test network)
```bash
# 1. Bring up a Fabric network + channel (Hyperledger fabric-samples)
cd fabric-samples/test-network
./network.sh up createChannel -c goldtrace-channel -ca

# 2. Deploy this chaincode
./network.sh deployCC -c goldtrace-channel -ccn goldtrace \
  -ccp /path/to/goldtrace-ghana/backend/blockchain/chaincode -ccl javascript

# 3. Run the gateway sidecar (point env at your peer's MSP material)
cd /path/to/goldtrace-ghana/backend/blockchain/gateway
npm install
PEER_ENDPOINT=localhost:7051 MSP_ID=Org1MSP CHANNEL=goldtrace-channel \
CHAINCODE=goldtrace CERT_PATH=... KEY_PATH=... TLS_CERT_PATH=... npm start

# 4. Enable anchoring in backend/.env
BLOCKCHAIN_ANCHORING_ENABLED=True
FABRIC_GATEWAY_URL=http://localhost:4000
```
For production, replace the test network with a multi-org setup (GoldBod,
Customs, BoG as peers) using private data collections for sensitive fields.
