# Analytics renewal UI

- `components/analytics-layout/analytics-layout.tsx` owns the shared header, navigation,
  theme, language, status polling and price widget. Pages must not duplicate these timers.
- `overview/renewal.scss` owns the shell/theme and Overview styles; `details.scss` owns
  Guardian/Delegator styles. Keep base rules together, followed by tablet/mobile overrides.
  Preserve selector specificity for `.rn-main.rd-main` against the shell's padding reset.
- `shared.tsx` contains page headings, search, metrics, notices, pagination and the shared
  stake chart. `address.tsx` measures available width and owns full/truncated address display.
- `guardians.tsx` owns directory/profile presentation; `delegators.tsx` is Stake-only.
  Data sources and existing chain semantics are not reimplemented in the UI.
- `read-cache.ts` scopes reads to the Web3 instance, shares pending promises across navigation,
  and caches successful results for five minutes from completion. Errors/null results are not
  cached. The UI deadline does not cancel underlying Web3 requests.
- Guardian history data/loading/error must update atomically: React 16 can render between
  separate promise-callback state updates. Do not render wallet rows until data exists.

Validation: `npm run typecheck`, `npm run test`, `npm run build`. For layout changes also
check both themes, narrow mobile/tablet/desktop, route re-entry, address resizing, and charts.

### Artwork and Guardian identity

- `Artwork` and `artwork-assets.json` supply transparent, content-hashed WebP variants
  at 1x/2x/3x. Figma handoff `221:613` in `NIrYefWckSmNy6IQ0kcScX` provides
  the original WebP in the second image fill of nodes `221:619` (coin),
  `221:622` (shield), and `221:625` (wallet). Do not reuse the old raster-wrapped
  SVG previews. Preserve original colors/alpha; do not apply theme filters.
- Coin/shield render at 180 CSS pixels; export 180/360/540 widths. Wallet renders
  at 240 CSS pixels; export 240/480/720 widths, preserving source aspect ratio.
  Current exports use Lanczos resizing and lossless WebP. Update the manifest
  and content hashes together when re-exporting. Existing server cache validation
  is unchanged; filenames prevent stale content without requiring a proxy restart.
- Overview clips artwork within the rounded metric card; image assets themselves
  are not cropped. Mobile boxed-tab styling lives in the shared shell stylesheet,
  scoped to the mobile breakpoint; desktop navigation is unchanged.
- Product override (2026-11-05 19:35): `guardianColor(rank)` uses the exact
  22 Figma palette slots by current committee rank, not fixed names/addresses.
  `useGuardianColor` resolves an address to its unfiltered committee rank so
  Overview dots/bars and directory/profile avatars agree regardless of search or
  display sorting. Unranked and rank >22 use #89849A. Actual rank changes may change
  colors. This explicitly supersedes the earlier Figma identity-assignment rule.
- Profile direct entry also loads the committee snapshot when absent. While it is
  unavailable, colors remain neutral rather than inventing a rank.
- Header language uses an accessible custom listbox (JP display / ja locale);
  clipboard success is checked before the checkmark/two-second live announcement,
  with a selectable full address on failure. Theme colors follow the handoff;
  sidebar/content equal backgrounds remain an intentional user override.
- GuardianDirectory derives displayedView from useIsMobileViewport: mobile is
  always cards, while the desktop view preference remains intact on resize.

- Designer update (2026-11-05 20:04): mobile uses the original colored boxed
  navigation tabs again. PageHeading shares the network selector across all pages; only Overview opts into
  the staking CTA via showStakeCta (network selector restored 2026-11-09).
  Dark logo changes only the wordmark fill; the symbol gradients are untouched.
  Guardian card-view SVG path is exported from Figma node 137:676 (not a font glyph).

### Subgraph failover

- Official Hub remains the primary. Optional build-time `REACT_APP_SUBGRAPH_ETH_ALT`
  and `REACT_APP_SUBGRAPH_POLYGON_ALT` configure backup event-history endpoints.
  Local deployment sets these in ignored `.env.local`; other deployments must inject
  them separately. They are public URLs, not credentials.
- Each network request has a 12-second deadline, including response-body parsing.
  Network/HTTP availability failures, invalid response bodies and server-side GraphQL
  errors trigger one backup attempt. HTTP 400/422 and GraphQL validation errors do
  not. Successful empty arrays remain valid results; partial/error responses are rejected.
- Once a primary fails, subsequent requests for that endpoint use its backup until
  full page reload. No failover preference is stored in localStorage/IndexedDB.
  Reload starts primary-first for new network reads; existing data caches still work.
  If backup also fails, errors propagate to existing loading-error/retry UI.
- This covers `posAnalyticsSubgraphEth/Pol` history reads only, not RPC, management
  node analytics, CoinGecko, or the unused legacy `querySubgraph` helper. It detects
  request failures, not silently stale or semantically incorrect successful data.

### Optional RPC failover

- `REACT_APP_MAINNET_RPC_ALT` (Ethereum) and `REACT_APP_POLYGON_RPC_ALT`
  are optional build-time backup URLs. Local `.env.local` contains empty entries
  for the operator to fill. Empty/unset means primary-only; no public backup is assumed.
- Web3 initialization, contract reads and Multicall use the same callback-compatible
  provider. Each HTTP/body request has a 12-second timeout. Availability failures
  switch read-only requests to ALT, whose chain ID is verified once (shared across
  concurrent reads) before querying balances. A wrong-chain ALT fails explicitly.
- Selection survives in-app navigation/retry but not a full reload. RPC execution
  errors such as reverts remain errors, not outages. Transaction/signing methods are
  never replayed to ALT. If both providers fail, existing error handling remains.
- This is browser-side RPC: use HTTPS endpoints that allow browser CORS. URL changes
  need a rebuild; any API key embedded in a frontend RPC URL is visible to clients.


### Price cache and optional fallback key

CoinGecko prices are stored in same-origin browser localStorage for 10 minutes,
including across page navigation and reloads. Web Locks coalesce requests between
supported browser tabs; memory caching remains available when storage is blocked.
Hidden pages do not periodically refresh. Only successful prices are cached. Failed
requests are not persisted or subject to a cooldown; reload retries immediately.

Optional build-time `REACT_APP_COINGECKO_API_KEY_ALT` supplies a secondary **Demo**
key for the same `api.coingecko.com` endpoint. Each refresh tries the primary first,
then the distinct nonempty alternative once if the primary fails (including HTTP,
timeout, or invalid data). Each attempt has an 8-second deadline. Successful fallback
results use the same 10-minute cache. Missing ALT preserves primary-only behavior;
if both fail, the widget displays dashes without breaking the page. Keys are never
stored in the price cache, but REACT_APP build variables are public in the frontend
bundle. This setting does not select the CoinGecko Pro API endpoint.
