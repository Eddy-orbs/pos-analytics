## The stack

Routing - https://reactrouter.com/ <br />
https://reactrouter.com/web/api/Hooks <br /><br />
Style - https://react-bootstrap.netlify.app/ <br />
https://getbootstrap.com/docs/4.0/utilities/spacing/ <br /><br />
State - redux, redux-thunk <br />

## Development

The Project works in tandem with [github.com/orbs-network/pos-analytics-lib](orbs-network/pos-analytics-lib).

### Environment variables

Create a local `.env` file before starting or building the application:

```dotenv
REACT_APP_MAINNET_RPC=https://...
REACT_APP_POLYGON_RPC=https://...
REACT_APP_SUBGRAPH_BASE_URL=https://hub.orbs.network
```

- `REACT_APP_MAINNET_RPC` and `REACT_APP_POLYGON_RPC` are required RPC
  endpoints for Ethereum and Polygon.
- `REACT_APP_SUBGRAPH_BASE_URL` is the optional base URL of the
  Subgraph-compatible GraphQL service used for indexed Guardian history. The
  default is `https://hub.orbs.network`. The application appends
  `/delegationsSubgraphEth` or `/delegationsSubgraphPolygon` for the selected
  chain.
- A non-default compatible service that also exposes the Delegator stake-event
  index enables indexed Delegator history. The legacy default host does not
  expose that index, so Delegator history uses the RPC compatibility path.
- Create React App embeds these values at build time. Rebuild the application
  after changing any of them, and do not commit the local `.env` file.

**For Production deployment, don't use a free Infura account!**

For a root-domain test deployment, set `PUBLIC_URL=/`. Static asset paths and
the per-chain router bases are then generated as `/ethereum` and `/polygon`.

## Load-aware detail data

Guardian and Delegator detail screens no longer preload their complete event
history. They read current contract state first and lazy-load only the range
required by the selected chart:

- Weeks: the current UTC week plus the previous nine weeks.
- Months: fetched on first selection, bounded to the current UTC month plus the
  previous eleven months; the chart renders ten buckets.
- UTC bucket boundaries are read with a bounded set of archive contract-state
  calls (11 samples for Weeks, 13 for the twelve-month cache), so normal chart
  loading issues no `eth_getLogs` request. Current state is reused, calls are
  paced at 350 ms, and repeated ranges use a five-minute UI cache. Current
  state has a one-minute TTL and is refreshed before an uncached history unit
  is loaded, so a long-open screen does not anchor Months to an old head.
- In-flight history/page requests are cancelled on route changes; request IDs
  prevent late responses from replacing the active address or period.
- Hidden rewards/actions routes redirect to Stake and do not issue their former
  event-log queries.
- Guardian delegators are loaded only on that tab, 50 rows at a time, from a
  block-pinned Subgraph snapshot plus the small post-snapshot RPC delta.

The analytics library also retains an adaptive event-mode compatibility
path with contiguous chunks, retry/backoff, deduplication, request cancellation
and chain-aware finality caches. Application startup resolves current contracts
with bounded `eth_call` hops instead of scanning Registry logs.

### Verification

```sh
npx tsc --noEmit
CI=true npx react-scripts test --watchAll=false
NODE_OPTIONS=--openssl-legacy-provider npm run build
```

The OpenSSL compatibility option is required when this legacy CRA/Webpack 4
application is built with current Node.js releases.

### `yarn start`

Runs the app in the development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

### `yarn build`

Builds the app for production to the `build` folder.<br />
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br />
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `yarn format`

Formats the entire code of the app by prettier rules

## Deploy GitHub Pages

* clone git
```
git clone https://github.com/orbs-network/pos-analytics
```

* Install
```
npm install
```

* Build only
Please note that the root domain needs to match the `Homepage` field in package.json.
```
npm run build
```

* Publish a version to branch gh-pages
```
npm run deploy
```

* Setting up github pages
Under setting of repository go to the github pages section and choose the branch `gh-pages` and the root directory and press `Save`. If you also published with a specific domain you can setup the Custom Domain name.

<img src="https://analyticsinsight.b-cdn.net/wp-content/uploads/2022/03/Polygon-MATIC-amp-Terra-LUNA-Price-Drop-Bitgert-Surge-To.jpeg" alt="drawing" width="200"/>

## Polygon network support
As of march 29 2022, Orbs network supports both ETH and Polygon network.

Staking and reward claiming is now cheaper and faster using the L2 Polygon netwrok.

Analytics UI also supports both

Network selector is on the left in a dropdown underneath the logo.
