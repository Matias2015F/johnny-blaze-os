import React from "react";
import OrdenShadowDecisionPanel from "./OrdenShadowDecisionPanel.jsx";
import { prepararOrdenShadowReadOnlyBridgeViewModel } from "./ordenShadowReadOnlyBridge.presenter.js";

class OrdenShadowReadOnlyBridgeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-amber-700 bg-amber-950/70 p-3 text-xs text-amber-100">
          Diagnóstico sombra no disponible.
        </div>
      );
    }

    return this.props.children;
  }
}

function OrdenShadowReadOnlyBridgeContent({ order, env }) {
  const viewModel = prepararOrdenShadowReadOnlyBridgeViewModel({ order, env });

  if (!viewModel.mounted) {
    return null;
  }

  return <OrdenShadowDecisionPanel shadowResult={viewModel.shadowResult} />;
}

export default function OrdenShadowReadOnlyBridge({ order, env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {} }) {
  return (
    <OrdenShadowReadOnlyBridgeErrorBoundary>
      <OrdenShadowReadOnlyBridgeContent order={order} env={env} />
    </OrdenShadowReadOnlyBridgeErrorBoundary>
  );
}
