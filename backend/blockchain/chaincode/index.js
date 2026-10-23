'use strict';

const { Contract } = require('fabric-contract-api');

/**
 * GoldTrace custody-anchoring chaincode.
 *
 * The ledger never stores gold data itself — only the SHA-256 hash of each
 * custody event, forming a tamper-evident, replicated chain of custody that
 * GoldBod, Customs and the Bank of Ghana nodes can independently verify.
 */
class GoldTraceContract extends Contract {

  /** Anchor one custody event hash. Keyed by (batchCode, eventId). */
  async AnchorEvent(ctx, eventId, batchCode, eventHash, previousHash, eventType, timestamp) {
    const key = ctx.stub.createCompositeKey('event', [batchCode, eventId]);
    const existing = await ctx.stub.getState(key);
    if (existing && existing.length > 0) {
      throw new Error(`event ${eventId} is already anchored`);
    }
    const record = {
      docType: 'custodyEvent',
      eventId, batchCode, eventHash, previousHash, eventType, timestamp,
      txId: ctx.stub.getTxID(),
    };
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));
    ctx.stub.setEvent('EventAnchored', Buffer.from(JSON.stringify(record)));
    return JSON.stringify({ txId: record.txId, key: `${batchCode}:${eventId}` });
  }

  /** Read a single anchored event. */
  async ReadEvent(ctx, batchCode, eventId) {
    const key = ctx.stub.createCompositeKey('event', [batchCode, eventId]);
    const data = await ctx.stub.getState(key);
    if (!data || data.length === 0) {
      throw new Error(`event ${eventId} not found for batch ${batchCode}`);
    }
    return data.toString();
  }

  /** Return the full anchored custody chain for a batch, in commit order. */
  async GetBatchHistory(ctx, batchCode) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey('event', [batchCode]);
    const events = [];
    for (let res = await iterator.next(); !res.done; res = await iterator.next()) {
      events.push(JSON.parse(res.value.value.toString()));
    }
    await iterator.close();
    return JSON.stringify(events);
  }

  /** Recompute-free integrity probe: does this hash match what was anchored? */
  async VerifyEvent(ctx, batchCode, eventId, eventHash) {
    const data = await ctx.stub.getState(
      ctx.stub.createCompositeKey('event', [batchCode, eventId]));
    if (!data || data.length === 0) return JSON.stringify({ found: false, valid: false });
    const record = JSON.parse(data.toString());
    return JSON.stringify({ found: true, valid: record.eventHash === eventHash });
  }
}

module.exports.contracts = [GoldTraceContract];
