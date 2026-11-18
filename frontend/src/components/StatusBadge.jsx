import React from "react";
import Status from "./Status.jsx";

/**
 * Backward compatibility re-export.
 * Directly renders the minimal dot + text Status component.
 */
export default function StatusBadge(props) {
  return <Status {...props} />;
}
