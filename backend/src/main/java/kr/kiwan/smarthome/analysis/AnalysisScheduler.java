package kr.kiwan.smarthome.analysis;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import kr.kiwan.smarthome.AppProperties;
import kr.kiwan.smarthome.analysis.PhotoAnalysisService.Verdict;
import kr.kiwan.smarthome.inquiry.ApplianceService;

/**
 * 접수된 가전을 차례로 판별한다.
 *
 * 업로드 요청 안에서 돌리지 않는 이유: 사진 판독은 몇 초가 걸리고, 그동안 신청자를 기다리게 할 수 없다.
 * 실패해도 접수는 이미 끝나 있어야 한다. 그래서 따로 돌면서 밀린 것을 집어 간다.
 */
@Profile("public")
@Component
@EnableScheduling
public class AnalysisScheduler {

    private static final Logger log = LoggerFactory.getLogger(AnalysisScheduler.class);

    private final AppProperties props;
    private final PhotoAnalysisService analysis;
    private final ApplianceService appliances;

    public AnalysisScheduler(AppProperties props, PhotoAnalysisService analysis, ApplianceService appliances) {
        this.props = props;
        this.analysis = analysis;
        this.appliances = appliances;
    }

    @Scheduled(initialDelay = 30_000, fixedDelay = 60_000)
    public void run() {
        if (!props.analysis().enabled()) {
            return;
        }
        List<Long> pending = appliances.pendingAnalysis(
                Math.max(props.analysis().maxAttempts(), 1),
                Math.max(props.analysis().batchSize(), 1));
        if (pending.isEmpty()) {
            return;
        }
        for (long id : pending) {
            try {
                appliances.markAttempt(id, null);
                Verdict v = analysis.judge(id);
                appliances.saveAutoAnalysis(id, v.modelName(), v.era(), v.iotStatus(), v.note(),
                        v.source(), v.confidence());
                int purged = analysis.purgeIfDone(id);
                log.info("자동판별 #{} {} / {} ({}){}", id, v.modelName(), v.iotStatus(), v.source(),
                        purged > 0 ? " · 사진 " + purged + "장 폐기" : "");
            } catch (Exception e) {
                appliances.markAttempt(id, e.toString());
                log.warn("자동판별 실패 #{}: {}", id, e.toString());
            }
        }
    }
}
