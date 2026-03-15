document.getElementById('copyBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
                return document.body.innerText;
            },
        });

        const prefix = "Create Anki content in type Enlish-new-words-163e4 with the keyword, the cloze properly, the Audio is the keyword with snake case and no case sensitive\n\n";
        await navigator.clipboard.writeText(prefix + result);
        document.getElementById('status').textContent = 'Copied!';
        setTimeout(() => {
            document.getElementById('status').textContent = '';
        }, 2000);
    } catch (err) {
        document.getElementById('status').textContent = 'Failed to copy.';
        console.error(err);
    }
});
