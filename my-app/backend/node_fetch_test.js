const fs = require('fs');

async function testFetch() {
    const payloadStr = fs.readFileSync('last_payload.json', 'utf8');
    console.log("Sending POST to http://127.0.0.1:8000/api/schedules/generate...");
    console.time("request");
    try {
        const res = await fetch("http://127.0.0.1:8000/api/schedules/generate", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: payloadStr,
            signal: AbortSignal.timeout(180000)
        });
        console.timeEnd("request");
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Response length:", text.length, "Snippet:", text.substring(0, 100));
    } catch (e) {
        console.timeEnd("request");
        console.error("Fetch threw error:", e.message);
    }
}
testFetch();
