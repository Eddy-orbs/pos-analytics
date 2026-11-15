import React, { Suspense } from "react"
import ReactDOM from "react-dom"
import { Provider } from "react-redux"
import {  ConnectedRouter } from "connected-react-router"
import * as serviceWorker from "./serviceWorker"
import { createBrowserHistory } from "history";
import store from "./redux/store/store"
import './i18n';
import { AppLoader } from "./components/app-loader/app-loader"
import AppWrapper from "./app-wrapper"

const history = createBrowserHistory()



ReactDOM.render(
  <Suspense fallback={<AppLoader />} >
    <Provider store={store}>
      <ConnectedRouter history={history}>
      <AppWrapper />
      </ConnectedRouter>
    </Provider>
  </Suspense>,
  document.getElementById("root"),
  () => document.documentElement.classList.remove("app-booting")
)
serviceWorker.unregister()
