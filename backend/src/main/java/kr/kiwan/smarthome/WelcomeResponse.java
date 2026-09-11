package kr.kiwan.smarthome;

public record WelcomeResponse(
        String service,
        String message,
        String serverTime,
        BackendInfo backend,
        DatabaseInfo database
) {
    public record BackendInfo(
            String framework,
            String java,
            String hostname,
            String startedAt,
            long uptimeSeconds
    ) {}

    public record DatabaseInfo(
            String status,
            String engine,
            String version,
            long visits,
            String error
    ) {}
}
