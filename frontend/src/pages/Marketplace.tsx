import { useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import StorefrontIcon from "@mui/icons-material/Storefront";
import TimelineIcon from "@mui/icons-material/Timeline";
import VerifiedIcon from "@mui/icons-material/Verified";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import { useNavigate } from "react-router-dom";
import { useMarketplaceQuery, useBatchesQuery, useListForSaleMutation,
  useUnlistBatchMutation, useBuyBatchMutation, useAggregateLotsMutation } from "../services/api";
import { useAppSelector } from "../app/hooks";
import type { MarketFilters, MarketListing } from "../types";

const RISK = { low: "success", medium: "warning", high: "error", critical: "error" } as const;
const ghs = (v: string | number | null | undefined) =>
  v == null || v === "" ? "—" : `GHS ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card><CardContent>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, letterSpacing: 1 }}>{label.toUpperCase()}</Typography>
      <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600 }}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </CardContent></Card>
  );
}

function PriceVsRef({ pct }: { pct: number | null }) {
  if (pct == null) return <Chip size="small" label="Unassayed — no reference" />;
  const below = pct <= 0;
  return (
    <Tooltip title="Asking price compared with fine-gold weight × Bank of Ghana reference rate">
      <Chip size="small" color={below ? "success" : pct > 10 ? "error" : "warning"}
        label={`${Math.abs(pct).toFixed(1)}% ${below ? "below" : "above"} reference`} />
    </Tooltip>
  );
}

export default function Marketplace() {
  const user = useAppSelector((s) => s.auth.user);
  const navigate = useNavigate();
  const [f, setF] = useState<MarketFilters>({ sort: "newest" });
  const filters = useMemo(() => f, [f]);
  const { data: market, isFetching } = useMarketplaceQuery(filters);
  const { data: batches, refetch } = useBatchesQuery();
  const [listForSale, { isLoading: listing }] = useListForSaleMutation();
  const [unlist] = useUnlistBatchMutation();
  const [buy, { isLoading: buying }] = useBuyBatchMutation();
  const [aggregate, { isLoading: aggregating }] = useAggregateLotsMutation();

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [listDlg, setListDlg] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [seal, setSeal] = useState("");
  const [offerFor, setOfferFor] = useState<MarketListing | null>(null);
  const [offer, setOffer] = useState("");

  const listings = market?.listings ?? [];
  const rate = Number(market?.summary.reference_rate_ghs_per_g ?? 0);
  const myGold = (batches?.results ?? []).filter((b) => b.current_owner === user?.id);
  const set = (k: keyof MarketFilters) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const err = (e: unknown, fallback: string) => (e as { data?: { detail?: string } })?.data?.detail || fallback;

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const doAggregate = async () => {
    try { const r = await aggregate(selected).unwrap(); setSelected([]); refetch(); setMsg({ type: "success", text: r.detail }); }
    catch (e) { setMsg({ type: "error", text: err(e, "Could not aggregate the selected lots.") }); }
  };
  const submitOffer = async (l: MarketListing, amount?: string) => {
    setMsg(null);
    try {
      const r = await buy({ id: l.id, offer_price_ghs: amount }).unwrap();
      setOfferFor(null);
      const flags = r.compliance?.review?.length ? ` Flags: ${r.compliance.review.join("; ")}` : "";
      setMsg({ type: "success", text: `${r.detail} (${r.batch_code})${flags}` });
    } catch (e) { setMsg({ type: "error", text: err(e, "Purchase request failed.") }); }
  };
  const doList = async () => {
    if (!listDlg) return;
    try {
      await listForSale({ id: listDlg, asking_price_ghs: price, seal_number: seal }).unwrap();
      setListDlg(null); setPrice(""); setSeal(""); refetch();
      setMsg({ type: "success", text: "Listed on the marketplace." });
    } catch (e) { setMsg({ type: "error", text: err(e, "Could not list this batch.") }); }
  };
  const listingBatch = myGold.find((b) => b.id === listDlg);
  const suggested = listingBatch && rate
    ? Number(listingBatch.fine_weight_g ?? (listingBatch.fineness ? Number(listingBatch.gross_weight_g) * listingBatch.fineness / 1000 : 0)) * rate
    : 0;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="h4">Gold marketplace</Typography>
          <Typography color="text.secondary">
            Licensed gold you are permitted to buy under the GoldBod trading order. Every lot shows its
            origin, purity, risk and how its price compares with the Bank of Ghana reference rate.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => navigate("/requests")} sx={{ alignSelf: { sm: "center" } }}>
          My offers & requests
        </Button>
      </Stack>

      {market?.me && (
        <Alert severity={market.me.can_buy_from.length ? "info" : "warning"} icon={false}
          action={<Button size="small" onClick={() => navigate("/rules")}>Trading rules</Button>}>
          <b>GoldBod rules for you ({market.me.role}):</b>{" "}
          {market.me.can_buy_from.length
            ? <>you may buy only from {market.me.can_buy_from.join(", ")}</>
            : <>your role may not buy gold on the local market</>}
          {" · "}
          {market.me.can_sell_to.length
            ? <>you may sell only to {market.me.can_sell_to.join(", ")}</>
            : <>your role may not resell gold</>}
          . Only lots you are allowed to buy are shown. Prices may not exceed GoldBod's published price.
        </Alert>
      )}
      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Box className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Lots available" value={String(market?.summary.count ?? "—")} />
        <Kpi label="Gold on offer" value={market ? `${Number(market.summary.total_weight_g).toLocaleString()} g` : "—"} />
        <Kpi label="Avg asking / gram" value={ghs(market?.summary.avg_price_per_gram)} sub="gross weight" />
        <Kpi label="BoG reference" value={ghs(market?.summary.reference_rate_ghs_per_g)} sub="per gram fine gold" />
      </Box>

      <Card><CardContent>
        <Box className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <TextField size="small" label="Search" placeholder="Code, region, seller…" value={f.q ?? ""} onChange={set("q")}
            sx={{ gridColumn: { xs: "span 2", lg: "span 2" } }} />
          <TextField size="small" select label="Region" value={f.region ?? ""} onChange={set("region")}>
            <MenuItem value="">All regions</MenuItem>
            {(market?.regions ?? []).map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField size="small" type="number" label="Min g" value={f.min_weight ?? ""} onChange={set("min_weight")} />
          <TextField size="small" type="number" label="Max g" value={f.max_weight ?? ""} onChange={set("max_weight")} />
          <TextField size="small" select label="Purity" value={f.min_fineness ?? ""} onChange={set("min_fineness")}>
            <MenuItem value="">Any</MenuItem>
            <MenuItem value="750">≥ 75% (18k)</MenuItem>
            <MenuItem value="850">≥ 85%</MenuItem>
            <MenuItem value="916">≥ 91.6% (22k)</MenuItem>
            <MenuItem value="995">≥ 99.5%</MenuItem>
          </TextField>
          <TextField size="small" select label="Max risk" value={f.max_risk ?? ""} onChange={set("max_risk")}>
            <MenuItem value="">Any</MenuItem>
            <MenuItem value="low">Low only</MenuItem>
            <MenuItem value="medium">Up to medium</MenuItem>
            <MenuItem value="high">Exclude critical</MenuItem>
          </TextField>
          <TextField size="small" select label="Sort" value={f.sort ?? "newest"} onChange={set("sort")}>
            <MenuItem value="newest">Newest</MenuItem>
            <MenuItem value="best_value">Best value vs reference</MenuItem>
            <MenuItem value="price_asc">Price: low → high</MenuItem>
            <MenuItem value="price_desc">Price: high → low</MenuItem>
            <MenuItem value="weight_desc">Heaviest first</MenuItem>
            <MenuItem value="purity_desc">Purest first</MenuItem>
          </TextField>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
          <FormControlLabel control={<Switch size="small" checked={f.assayed === "1"}
            onChange={(e) => setF({ ...f, assayed: e.target.checked ? "1" : "" })} />} label="Assayed only" />
          <Button size="small" onClick={() => setF({ sort: "newest" })}>Clear filters</Button>
          {isFetching && <Typography variant="caption" color="text.secondary">Updating…</Typography>}
        </Stack>
      </CardContent></Card>

      <Box className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {listings.map((l) => (
          <Card key={l.id} sx={{ display: "flex", flexDirection: "column" }}>
            <CardContent sx={{ flex: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography className="mono" sx={{ fontWeight: 700 }}>{l.batch_code}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {[l.district, l.region].filter(Boolean).join(", ") || "Region not set"}
                    {l.concession ? ` · ${l.concession}` : ""}
                  </Typography>
                </Box>
                <Chip size="small" color={RISK[l.risk_band]} label={`Risk ${l.risk_score} · ${l.risk_band}`} />
              </Stack>

              <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600, mt: 1.5 }}>
                {ghs(l.asking_price_ghs)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {Number(l.gross_weight_g).toLocaleString()} g gross
                {l.fine_weight_g ? ` · ${Number(l.fine_weight_g).toLocaleString()} g fine` : ""}
                {l.price_per_gram ? ` · ${ghs(l.price_per_gram)}/g` : ""}
              </Typography>

              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1.5 }}>
                <PriceVsRef pct={l.price_vs_reference_pct} />
                <Chip size="small" variant="outlined"
                  label={l.fineness ? `${(l.fineness / 10).toFixed(1)}% pure${l.assayed ? " · assayed" : " · declared"}` : "Purity unknown"} />
                {l.chain_valid && <Chip size="small" icon={<VerifiedIcon />} label="Custody intact" variant="outlined" color="success" />}
                {l.has_gps_origin && <Chip size="small" icon={<GpsFixedIcon />} label="GPS origin" variant="outlined" />}
                {l.is_aggregated && <Chip size="small" variant="outlined" label={`From ${l.source_lot_count} lots`} />}
              </Stack>

              <Typography variant="body2" sx={{ mt: 1.5 }}>
                Seller: <b>{l.seller_name}</b> ({l.seller_role})
              </Typography>
              {l.trade_rule && (
                <Typography variant="caption" display="block" sx={{ color: "#2E7D32" }}>
                  ✓ {l.trade_rule}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Producer licence {l.producer_licence ?? "—"} · {l.producer_licence_status ?? "unknown"}
                {" · "}listed {new Date(l.listed_at).toLocaleDateString()}
              </Typography>
            </CardContent>
            <Stack direction="row" spacing={1} sx={{ p: 2, pt: 0 }}>
              <Button size="small" startIcon={<TimelineIcon />} onClick={() => navigate(`/track?code=${l.batch_code}`)}>
                Trace
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="outlined" disabled={buying}
                onClick={() => { setOfferFor(l); setOffer(l.asking_price_ghs); }}>Make offer</Button>
              <Button size="small" variant="contained" startIcon={<StorefrontIcon />} disabled={buying}
                onClick={() => submitOffer(l)}
                sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>Buy</Button>
            </Stack>
          </Card>
        ))}
      </Box>
      {listings.length === 0 && (
        <Card><CardContent>
          <Typography color="text.secondary">
            No gold matches these filters, or none is currently listed that your role may buy.
          </Typography>
        </CardContent></Card>
      )}

      <Card><CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" gutterBottom>Your gold — list, aggregate or trace</Typography>
          <Button size="small" variant="outlined" disabled={selected.length < 2 || aggregating}
            onClick={doAggregate}>Aggregate {selected.length > 0 ? `(${selected.length})` : ""}</Button>
        </Stack>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell padding="checkbox" />
            <TableCell>Batch</TableCell><TableCell>Gross (g)</TableCell><TableCell>Purity</TableCell>
            <TableCell>Status</TableCell><TableCell>Listed</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {myGold.map((b) => (
              <TableRow key={b.id} hover>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} />
                </TableCell>
                <TableCell className="mono">{b.batch_code}</TableCell>
                <TableCell>{b.gross_weight_g}</TableCell>
                <TableCell>{b.fineness ? `${(b.fineness / 10).toFixed(1)}%` : "—"}</TableCell>
                <TableCell>{b.status_display}</TableCell>
                <TableCell>{b.listed_for_sale ? <Chip size="small" color="secondary" label={ghs(b.asking_price_ghs)} /> : "—"}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Button size="small" onClick={() => navigate(`/track?code=${b.batch_code}`)}>Trace</Button>
                  {b.listed_for_sale
                    ? <Button size="small" color="inherit" onClick={() => { unlist(b.id); refetch(); }}>Unlist</Button>
                    : <Button size="small" onClick={() => { setListDlg(b.id); setPrice(""); }}>List for sale</Button>}
                </TableCell>
              </TableRow>
            ))}
            {myGold.length === 0 && <TableRow><TableCell colSpan={7}>
              <Typography color="text.secondary">You don't currently hold any gold to sell.</Typography>
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!listDlg} onClose={() => setListDlg(null)} fullWidth maxWidth="xs">
        <DialogTitle>List gold for sale</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {suggested > 0 && (
              <Alert severity="info">
                Reference value {ghs(suggested.toFixed(2))} (fine gold × BoG rate).{" "}
                <Button size="small" onClick={() => setPrice(suggested.toFixed(2))}>Use it</Button>
              </Alert>
            )}
            <TextField label="Asking price (GHS)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            <TextField label="Tamper-evident seal number (optional)" value={seal} onChange={(e) => setSeal(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListDlg(null)}>Cancel</Button>
          <Button variant="contained" onClick={doList} disabled={listing || !price}
            sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>List it</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!offerFor} onClose={() => setOfferFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>Make an offer · {offerFor?.batch_code}</DialogTitle>
        <DialogContent>
          {offerFor && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2">
                Asking <b>{ghs(offerFor.asking_price_ghs)}</b>
                {offerFor.reference_value_ghs ? <> · reference value <b>{ghs(offerFor.reference_value_ghs)}</b></> : null}
              </Typography>
              <TextField label="Your offer (GHS)" type="number" value={offer} onChange={(e) => setOffer(e.target.value)} />
              <Typography variant="caption" color="text.secondary">
                Your offer goes to {offerFor.seller_name} for approval. Compliance checks run first; nothing changes
                hands until the seller (or a GoldBod officer) accepts, then your receipt is issued automatically.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOfferFor(null)}>Cancel</Button>
          <Button variant="contained" disabled={buying || !offer || Number(offer) <= 0}
            onClick={() => offerFor && submitOffer(offerFor, offer)}
            sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>Send offer</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
