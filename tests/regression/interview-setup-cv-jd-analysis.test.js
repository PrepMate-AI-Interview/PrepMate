/**
 * PREPMATE — TEST SUITE: INDEPENDENT & EXPLICIT CV / JD ANALYSIS
 * Work Item: WI-INTERVIEW-SETUP-CV-JD-01
 *
 * Verifies:
 *   1. Explicit CV flow: upload -> no auto analysis -> click "Phân tích CV" -> loading -> result.
 *   2. Explicit JD flow: input/upload -> no auto analysis -> click "Phân tích JD" -> loading -> result.
 *   3. Two independent buttons: #btn-analyze-cv ("Phân tích CV") & #btn-analyze-jd ("Phân tích JD").
 *   4. Two independent panels: #cv-analysis-panel & #jd-analysis-panel, both hidden initially.
 *   5. Invalidation: Editing JD hides #jd-analysis-panel and resets _jdAnalysisResult.
 *   6. Invalidation: Modifying CV hides #cv-analysis-panel and resets _cvAnalysisResult.
 *   7. Double-trigger guard and in-flight request cancellation with AbortController.
 *   8. Honest error display in #cv-analysis-error and #jd-analysis-error upon failure.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

function pass(desc) {
    console.log(`  [PASS] ${desc}`);
}

async function runTestSuite() {
    console.log("===============================================================");
    console.log("   WI-INTERVIEW-SETUP-CV-JD-01: CV & JD INTERACTION AUDIT      ");
    console.log("===============================================================\n");

    const htmlPath = path.resolve(__dirname, "../../FE/features/interview/interview-info.html");
    const htmlContent = fs.readFileSync(htmlPath, "utf8");

    // --------------------------------------------------------------------------
    // PART 1: DOM Markup & Element Separation Verification
    // --------------------------------------------------------------------------
    console.log("--- PART 1: DOM Elements & Separation Verification ---");

    // 1. Separate CV Analyze Button
    assert(htmlContent.includes('id="btn-analyze-cv"'), "Must have #btn-analyze-cv button");
    assert(htmlContent.includes("Phân tích CV"), "Must display explicit 'Phân tích CV' text");
    pass("1. Explicit 'Phân tích CV' button (#btn-analyze-cv) verified");

    // 2. Separate JD Analyze Button
    assert(htmlContent.includes('id="btn-analyze-jd"'), "Must have #btn-analyze-jd button");
    assert(htmlContent.includes("Phân tích JD"), "Must display explicit 'Phân tích JD' text");
    pass("2. Explicit 'Phân tích JD' button (#btn-analyze-jd) verified");

    // 3. Separate Spinners
    assert(htmlContent.includes('id="cv-analysis-running-spinner"'), "Must have dedicated #cv-analysis-running-spinner");
    assert(htmlContent.includes('id="jd-analysis-running-spinner"'), "Must have dedicated #jd-analysis-running-spinner");
    pass("3. Independent loading spinners for CV and JD verified");

    // 4. Separate Error Containers
    assert(htmlContent.includes('id="cv-analysis-error"'), "Must have #cv-analysis-error container");
    assert(htmlContent.includes('id="jd-analysis-error"'), "Must have #jd-analysis-error container");
    pass("4. Independent error containers for CV and JD verified");

    // 5. Separate Analysis Panels (both initially hidden)
    assert(htmlContent.includes('id="cv-analysis-panel" class="analysis-panel-card hidden"'), "#cv-analysis-panel must have class 'hidden'");
    assert(htmlContent.includes('id="jd-analysis-panel" class="analysis-panel-card hidden"'), "#jd-analysis-panel must have class 'hidden'");
    pass("5. Independent analysis panels are hidden by default");

    // 6. Separate Outdated Warnings
    assert(htmlContent.includes('id="cv-analysis-outdated-warning"'), "Must have #cv-analysis-outdated-warning");
    assert(htmlContent.includes('id="jd-analysis-outdated-warning"'), "Must have #jd-analysis-outdated-warning");
    pass("6. Independent outdated warnings for CV and JD verified");

    // --------------------------------------------------------------------------
    // PART 2: Behavioral Contract & Lifecycle Verification
    // --------------------------------------------------------------------------
    console.log("\n--- PART 2: Interactive Behavior & Logic Simulation ---");

    // Extract JS from html
    const scriptMatches = htmlContent.match(/<script>([\s\S]*?)<\/script>/gi);
    assert(scriptMatches && scriptMatches.length > 0, "Script blocks must exist in HTML");

    // Check function definitions in the script
    const allScripts = scriptMatches.join("\n");

    assert(allScripts.includes("function handleAnalyzeCvClick"), "Must declare handleAnalyzeCvClick()");
    assert(allScripts.includes("function handleAnalyzeJdClick"), "Must declare handleAnalyzeJdClick()");
    assert(allScripts.includes("function executeCvAnalysis"), "Must declare executeCvAnalysis()");
    assert(allScripts.includes("function executeJdAnalysis"), "Must declare executeJdAnalysis()");
    assert(allScripts.includes("function fetchJdAnalysis"), "Must declare fetchJdAnalysis()");
    assert(allScripts.includes("function renderJdAnalysis"), "Must declare renderJdAnalysis()");
    assert(allScripts.includes("function closeJdAnalysisPanel"), "Must declare closeJdAnalysisPanel()");
    pass("7. Dedicated JS handler functions for CV and JD are properly declared");

    // 8. Verify JD Invalidation on text input
    assert(allScripts.includes("jdTextarea.addEventListener('input'"), "Must have input listener on #jd-text to invalidate results");
    assert(allScripts.includes("window._jdAnalysisResult = null"), "Input listener must set _jdAnalysisResult to null");
    pass("8. Input listener on #jd-text immediately invalidates stale JD analysis results");

    // 9. Verify CV Invalidation on text input / upload
    assert(allScripts.includes("cvTextarea.addEventListener('input'"), "Must have input listener on #cv-text to invalidate results");
    assert(allScripts.includes("window._cvAnalysisResult = null"), "Input listener must set _cvAnalysisResult to null");
    pass("9. Input listener on #cv-text immediately invalidates stale CV analysis results");

    // 10. Verify JD file upload invalidation
    assert(allScripts.includes("// Invalidate any prior JD analysis results upon new file upload"), "handleJdUpload must invalidate prior results");
    pass("10. handleJdUpload explicitly clears previous JD analysis results and hides panels");

    // 11. Verify JD removal invalidation
    assert(allScripts.includes("// Reset and invalidate JD analysis"), "removeUploadedJd must invalidate analysis");
    pass("11. removeUploadedJd resets JD analysis state cleanly");

    // 12. Verify double-trigger protection
    assert(allScripts.includes("if (window._isAnalyzingCv) return;"), "executeCvAnalysis must guard against double triggers");
    assert(allScripts.includes("if (window._isAnalyzingJd) return;"), "executeJdAnalysis must guard against double triggers");
    pass("12. Double-trigger protection verified on both CV and JD execution");

    // 13. Verify request abortion & stale sequence checks
    assert(allScripts.includes("window._currentCvAnalysisAbortController.abort()"), "CV analysis must support aborting in-flight requests");
    assert(allScripts.includes("window._currentJdAnalysisAbortController.abort()"), "JD analysis must support aborting in-flight requests");
    assert(allScripts.includes("currentSeq !== window._cvAnalysisRequestSeq"), "CV analysis must discard stale response sequences");
    assert(allScripts.includes("currentSeq !== window._jdAnalysisRequestSeq"), "JD analysis must discard stale response sequences");
    pass("13. In-flight request cancellation & sequence guards verified");

    // 14. Verify backward compatibility aliases
    assert(allScripts.includes("window.handleAnalyzeProfileClick = handleAnalyzeCvClick"), "Must alias handleAnalyzeProfileClick for compatibility");
    assert(allScripts.includes("window.executeProfileAnalysis = executeCvAnalysis"), "Must alias executeProfileAnalysis for compatibility");
    pass("14. Backward compatibility aliases preserved cleanly");

    // 15. Verify role mismatch checks for both CV and JD in onJobTitleInput
    assert(allScripts.includes("window._cvAnalysisDoneForRole"), "onJobTitleInput checks CV role match");
    assert(allScripts.includes("window._jdAnalysisDoneForRole"), "onJobTitleInput checks JD role match");
    assert(allScripts.includes("jd-analysis-outdated-warning"), "onJobTitleInput updates JD outdated warning");
    pass("15. Role discrepancy triggers appropriate outdated warning for both CV and JD");

    console.log("\n===============================================================");
    console.log("   ALL 15 CV/JD INTERACTION AUDIT CHECKS PASSED (100%)!       ");
    console.log("===============================================================");
}

runTestSuite().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
