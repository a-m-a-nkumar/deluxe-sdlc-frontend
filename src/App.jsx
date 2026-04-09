import React from "react";
import ReactDOM from "react-dom";

import "./index.scss";

import NoopComponent from "REMOTE/NoopComponent";
import { NoopComponent as NoopComponent2 } from "./components/NoopComponent"

const App = () => (
  <div className="container">
    <div className="host">
      <h1>HOST</h1>
      <NoopComponent2 />
    </div>
    <div className="remote">
      <h1>REMOTE</h1>
      <NoopComponent />
    </div>
  </div>
);
ReactDOM.render(<App />, document.getElementById("app"));
