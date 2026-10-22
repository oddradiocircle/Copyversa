// CopyVersa runs only on the tab where it is invoked, through the toolbar
// button or its shortcut. It needs no access to any site in advance.
chrome.action.onClicked.addListener((tab) => {
    chrome.scripting
        .executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
        .catch((error) => console.warn('CopyVersa cannot run on this page:', error.message));
});
