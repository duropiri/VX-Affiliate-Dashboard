"use client";

import { useState, useEffect } from "react";
import { connectionManager, checkDatabaseHealth } from "@/lib/supabase";

interface ConnectionStatus {
  isHealthy: boolean;
  latency: number;
  lastCheck: number;
  consecutiveFailures: number;
}

export default function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isHealthy: true,
    latency: 0,
    lastCheck: 0,
    consecutiveFailures: 0
  });
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      const manager = connectionManager;
      setStatus({
        isHealthy: manager.isConnectionHealthy(),
        latency: manager.getConnectionLatency(),
        lastCheck: Date.now(),
        consecutiveFailures: 0 // We'll get this from the manager state
      });
    };

    // Update status immediately
    updateStatus();

    // Update status every 30 seconds
    const interval = setInterval(updateStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const health = await checkDatabaseHealth();
      setStatus(prev => ({
        ...prev,
        isHealthy: health.healthy,
        lastCheck: Date.now()
      }));
    } catch (error) {
      console.error('Manual health check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusColor = () => {
    if (isChecking) return "primary" as const;
    if (status.isHealthy) return "success" as const;
    if (status.consecutiveFailures > 0) return "warning" as const;
    return "danger" as const;
  };

  const getStatusTooltip = () => {
    if (isChecking) return "Checking connection...";
    if (status.isHealthy) return `Connected${status.latency > 0 ? ` (${status.latency}ms)` : ''}`;
    if (status.consecutiveFailures > 0) return "Connection unstable";
    return "Connection failed";
  };

  // Return the status info instead of rendering a component
  return {
    isBordered: true,
    color: getStatusColor(),
    onClick: handleManualCheck,
    title: getStatusTooltip(),
    isHealthy: status.isHealthy,
    isChecking
  };
} 