// frontend/src/components/common/ConnectionStatus.tsx
import React, { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

interface ConnectionStatusProps {
  socket: Socket | null;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ socket }) => {
  const [connected, setConnected] = useState<boolean>(!!socket?.connected);
  const [statusText, setStatusText] = useState<string>(socket?.connected ? "Online" : "Disconnected");

  useEffect(() => {
    if (!socket) {
      setConnected(false);
      setStatusText("Disconnected");
      return;
    }
    const onConnect = () => {
      setConnected(true);
      setStatusText("Online");
    };
    const onDisconnect = () => {
      setConnected(false);
      setStatusText("Disconnected");
    };
    const onReconnectAttempt = () => {
      setConnected(false);
      setStatusText("Reconnecting…");
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("reconnect_attempt", onReconnectAttempt);

    // initial state
    setConnected(!!socket.connected);
    setStatusText(socket.connected ? "Online" : "Disconnected");

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("reconnect_attempt", onReconnectAttempt);
    };
  }, [socket]);

  const style: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    color: connected ? "#064e3b" : "#7f1d1d",
    background: connected ? "#bbf7d0" : "#fecaca",
    border: connected ? "1px solid #10b981" : "1px solid #ef4444",
  };

  return (
    <div style={{ display: "inline-block", marginLeft: 12 }}>
      <span style={style}>{statusText}</span>
    </div>
  );
};

export default ConnectionStatus;
