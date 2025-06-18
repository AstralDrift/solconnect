use prometheus::{
    Histogram, IntCounter, IntGauge, Registry, TextEncoder,
    HistogramVec,
};

// Metrics are like opinions - everyone has them, but some are more useful than others

#[derive(Clone)]
pub struct Metrics {
    pub registry: Registry,
    pub messages_processed: IntCounter,
    pub messages_failed: IntCounter,
    pub bytes_received: IntCounter,
    pub bytes_sent: IntCounter,
    pub active_connections: IntGauge,
    pub message_latency: Histogram,
    pub message_size: HistogramVec,
    pub connection_duration: Histogram,
}

impl Metrics {
    pub fn new() -> Self {
        let registry = Registry::new();
        
        let messages_processed = IntCounter::new(
            "solchat_messages_processed_total",
            "Total number of messages processed by the relay"
        ).unwrap();
        
        let messages_failed = IntCounter::new(
            "solchat_messages_failed_total", 
            "Total number of failed message processing attempts"
        ).unwrap();
        
        let bytes_received = IntCounter::new(
            "solchat_bytes_received_total",
            "Total bytes received by the relay"
        ).unwrap();
        
        let bytes_sent = IntCounter::new(
            "solchat_bytes_sent_total",
            "Total bytes sent by the relay"
        ).unwrap();
        
        let active_connections = IntGauge::new(
            "solchat_active_connections",
            "Number of active QUIC connections"
        ).unwrap();
        
        let message_latency = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "solchat_message_latency_seconds", 
                "Message processing latency in seconds"
            ).buckets(vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0])
        ).unwrap();
        
        let message_size = HistogramVec::new(
            prometheus::HistogramOpts::new(
                "solchat_message_size_bytes", 
                "Message size distribution"
            ).buckets(vec![64.0, 256.0, 1024.0, 4096.0, 16384.0, 65536.0]),
            &["message_type"]
        ).unwrap();
        
        let connection_duration = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "solchat_connection_duration_seconds", 
                "Connection duration in seconds"
            ).buckets(vec![1.0, 10.0, 60.0, 300.0, 1800.0, 3600.0])
        ).unwrap();
        
        // Register all metrics
        registry.register(Box::new(messages_processed.clone())).unwrap();
        registry.register(Box::new(messages_failed.clone())).unwrap();
        registry.register(Box::new(bytes_received.clone())).unwrap();
        registry.register(Box::new(bytes_sent.clone())).unwrap();
        registry.register(Box::new(active_connections.clone())).unwrap();
        registry.register(Box::new(message_latency.clone())).unwrap();
        registry.register(Box::new(message_size.clone())).unwrap();
        registry.register(Box::new(connection_duration.clone())).unwrap();
        
        Self {
            registry,
            messages_processed,
            messages_failed,
            bytes_received,
            bytes_sent,
            active_connections,
            message_latency,
            message_size,
            connection_duration,
        }
    }
    
    pub fn export_metrics(&self) -> Result<String, prometheus::Error> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        encoder.encode_to_string(&metric_families)
    }
    
    pub fn record_message_processed(&self, size: usize, message_type: &str) {
        self.messages_processed.inc();
        self.message_size
            .with_label_values(&[message_type])
            .observe(size as f64);
    }
    
    pub fn record_message_failed(&self) {
        self.messages_failed.inc();
    }
    
    pub fn record_bytes_received(&self, bytes: usize) {
        self.bytes_received.inc_by(bytes as u64);
    }
    
    pub fn record_bytes_sent(&self, bytes: usize) {
        self.bytes_sent.inc_by(bytes as u64);
    }
    
    pub fn increment_connections(&self) {
        self.active_connections.inc();
    }
    
    pub fn decrement_connections(&self) {
        self.active_connections.dec();
    }
    
    pub fn record_latency(&self, duration: f64) {
        self.message_latency.observe(duration);
    }
    
    pub fn record_connection_duration(&self, duration: f64) {
        self.connection_duration.observe(duration);
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_metrics_creation() {
        let metrics = Metrics::new();
        
        // Verify metrics are registered
        let metric_families = metrics.registry.gather();
        assert!(!metric_families.is_empty());
        
        // Test basic operations
        metrics.record_message_processed(1024, "ChatMessage");
        metrics.record_bytes_received(2048);
        metrics.increment_connections();
        
        assert_eq!(metrics.messages_processed.get(), 1);
        assert_eq!(metrics.bytes_received.get(), 2048);
        assert_eq!(metrics.active_connections.get(), 1);
    }
    
    #[test]
    fn test_metrics_export() {
        let metrics = Metrics::new();
        metrics.record_message_processed(512, "AckMessage");
        
        let exported = metrics.export_metrics().unwrap();
        assert!(exported.contains("solchat_messages_processed_total"));
        assert!(exported.contains("solchat_message_size_bytes"));
    }
} 