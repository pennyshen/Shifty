var keyToIdMap = {};
var unshiftedToShiftedMap = {};
var symbolsUnshifted = "`1234567890-=[]\\;',./";
var allKeysShifted = "";

var DOM_KEY_LOCATION_LEFT = 1;
var DOM_KEY_LOCATION_RIGHT = 2;

var result = {};
var currentWordResult = {};

var typedKeys = "";
var currentWord;

var allWords = [];
var numWords;

var shiftPressed = {
    "l": false,
    "r": false
};

var firebase = new Firebase("https://shifty-quiz.firebaseio.com/user-stats");

var debugging = true;

function init() {
    initKeyboardConfig();
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
        generateKeyboard();
    }
    setElementVisibility("mobileText", isMobile);
    setElementVisibility("startQuizButton", !isMobile);
}

function resetForQuiz() {
    for (var i = 0; i < allShiftedKeys.length; i++) {
        result[allShiftedKeys[i]] = [];
    }
    shiftPressed["l"] = false;
    shiftPressed["r"] = false;
    currentWordResult = {};
    currentWord = null;
    typedKeys = "";
    clearAllHighlight();
}

function displayNextWord() {
    // set progress bar first
    var progressBar = document.getElementById("progress-bar");
    var progress = Math.floor(allWords.length*100.0/numWords);
    progressBar.style.width = progress + "%";
    progressBar.setAttribute("aria-valueNow", progress);

    if (allWords && allWords.length > 0) {
        var nextWord = allWords.shift();
        currentWord = nextWord;
        document.getElementById("quizWord").innerHTML = nextWord;
        return true;
    }
    return false;
}

function whichShiftKey() {
    for (shiftLocation in shiftPressed) {
        if (shiftPressed[shiftLocation]) {
            return shiftLocation;
        }
    }
    return null;
}

function getKeyElement(key, isShifted) {
    if (!isShifted) {
        key = unshiftedToShiftedMap[key];
    }
    return document.getElementById(keyToIdMap[key]);
}

function highlightElement(element, shiftLocation) {
    var className;
    if (shiftLocation) {
        className = shiftLocation + "_shift";
    } else {
        className = "no_shift";
    }
    element.className = element.className + " " + className;
}

function setHighlight(e, toHighlight) {
    var element = getKeyElement(keyboardMap[getKeyCode(e)], false);
    if (toHighlight) {
        var shiftLocation;
        if (e.shiftKey) {
            shiftLocation = whichShiftKey();
        }
        highlightElement(element, shiftLocation);
    } else {
        clearHighlight(element);
    }
}

function clearAllHighlight() {
    for (var i = 0; i < allKeysShifted.length; i++) {
        clearHighlight(getKeyElement(allKeysShifted[i], true));
    }
}

function clearHighlight(element) {
    clearStyling(element, ["l_shift", "r_shift", "no_shift"]);
}

function clearStyling(element, classes) {
    var className = element.className;
    for (var i = 0; i < classes.length; i++) {
        className = className.replace(" " + classes[i], "");
    }
    element.className = className;
}

function getKeyCode(e) {
    return e.which || e.keyCode;
}

function setShiftPressed(e, isPressed) {
    var shiftLocation;
    if (e.location === DOM_KEY_LOCATION_LEFT) {
        shiftLocation = "l";
    } else if (e.location === DOM_KEY_LOCATION_RIGHT) {
        shiftLocation = "r";
    }
    shiftPressed[shiftLocation] = isPressed;
}

function keyDownListener(e) {
    var key = keyboardMap[getKeyCode(e)];
    if (key === "SHIFT") {
        setShiftPressed(e, true);
    } else if (key in unshiftedToShiftedMap) {
        setHighlight(e, true);
        var actualKey = e.shiftKey ? unshiftedToShiftedMap[key] : key;
        typedKeys += actualKey;
        if (e.shiftKey) {
            recordResult(actualKey);
        }
        checkWord();
    }
}

function keyUpListener(e) {
    var key = keyboardMap[getKeyCode(e)];
    if (key === "SHIFT") {
        setShiftPressed(e, false);
    } else if (key in unshiftedToShiftedMap) {
        setHighlight(e, false);
    }
}

function resetForWord() {
    currentWordResult = {};
    typedKeys = "";
}

function recordResult(key) {
    var shiftLocation = whichShiftKey();
    if (shiftLocation) {
        if (!currentWordResult[key]) {
            currentWordResult[key] = [];
        }
        currentWordResult[key].push(shiftLocation);
    }
}

function checkWord() {
    var wordElement = document.getElementById("quizWord");
    var pos = typedKeys.length - 1;
    if (currentWord[pos] !== typedKeys[pos]) {
        // typed wrong, must retype the whole thing
        resetForWord();
        wordElement.innerHTML = currentWord;
        return;
    }

    wordElement.innerHTML = currentWord.replace(typedKeys, "<span class='correct'>" + typedKeys + "</span>");
    if (currentWord.length === typedKeys.length && currentWord === typedKeys) {
        // typed everything right
        for (key in currentWordResult) {
            result[key] = result[key].concat(currentWordResult[key]);
        }
        resetForWord();
        // wait a little before showing next word or else things disappear too fast
        setTimeout(function() {
            var hasNextWord = displayNextWord();
            if (!hasNextWord) {
                finishQuiz();
            }
        }, 100);
    }
}

function showResult() {
    setElementVisibility("quizPrompt", false);
    setElementVisibility("quizResult", true);

    var allShifts = 0;
    var shiftCount = {
        "l": 0,
        "r": 0
    }
    var loggedResult = {};
    for (key in result) {
        var locations = result[key];
        if (locations.length > 0) {
            var element = getKeyElement(key, true);
            var location = locations[0];    // just go by the first one for now
            highlightElement(element, location);
            allShifts += 1;
            shiftCount[location] += 1;
            loggedResult[keyToIdMap[key]] = location;
        }
    }
    for (var location in shiftCount) {
        var count = shiftCount[location];
        var percentage = Math.floor(count*100.0 / allShifts);
        document.getElementById(location + "_result").innerHTML = percentage + "% (" + count + "/" + allShifts + ")";
    }

    if (!debugging) {
        firebase.push({
            timestamp: (new Date()).getTime(),
            shifCount: shiftCount,
            result: loggedResult
        });
    }
}

function finishQuiz() {
    document.documentElement.removeEventListener("keydown", keyDownListener);
    document.documentElement.removeEventListener("keyup", keyUpListener);
    setElementVisibility("keyboardHint", true, true);
    clearAllHighlight();
    showResult();
}

function startQuiz() {
    resetForQuiz();
    setElementVisibility("quizResult", false);
    setElementVisibility("quizPrompt", true);
    setElementVisibility("keyboardHint", false, true);
    document.documentElement.addEventListener("keydown", keyDownListener);
    document.documentElement.addEventListener("keyup", keyUpListener);

    allWords = getQuizWords();
    combineSymbolsWithKeys(allWords);
    numWords = allWords.length;
    displayNextWord();
}

function showQuiz() {
    setElementVisibility("landing", false);
    setElementVisibility("quiz", true);
}

function combineSymbolsWithKeys(words) {
    var symbolsArray = [];
    for (var i = 0; i < words.length; i++) {
        if (i < symbolsUnshifted.length) {
            symbolsArray.push(unshiftedToShiftedMap[symbolsUnshifted[i]]);
        } else {
            symbolsArray.push("");
        }
        shuffle(symbolsArray);
    }
    for (var i = 0; i < words.length; i++) {
        words[i] += symbolsArray[i];
    }
}

function setElementVisibility(id, isVisible, occupySpace) {
    var element = document.getElementById(id);
    var className = occupySpace ? "invisible" : "hide";
    if (isVisible) {
        clearStyling(element, [className]);
    } else {
        element.className = element.className + " " + className;
    }
}

function generateKeyboard() {
    var keyboardElement = document.getElementById("keyboard");
    var symbolIndex = 0;
    for (var rowNum = 0; rowNum < keyboardValues.length; rowNum++) {
        var rowValues = keyboardValues[rowNum];
        var rowElement = document.createElement("div");
        rowElement.className = "row row" + rowNum;
        allKeysShifted += rowValues;
        for (var textPos = 0; textPos < rowValues.length; textPos++) {
            var keyValue = rowValues[textPos];
            var keyElement = document.createElement("div");
            // NOTE: THIS ID IS USED FOR LOGGING USER STATS - NEED TO 
            //       SAVE NEW VERSION OF ID IN DATABASE IF WE CHANGE IT
            var id = "key_" + rowNum + "_" + textPos;
            keyElement.className = "key button";
            keyElement.id = id;
            keyElement.innerHTML = keyValue;
            rowElement.appendChild(keyElement);

            keyToIdMap[keyValue] = id;

            var unshiftedValue;
            if (keyValue.match(/[A-Z]/)) {
                unshiftedValue = keyValue.toLowerCase();
            } else {
                unshiftedValue = symbolsUnshifted[symbolIndex];
                symbolIndex++;
            }
            keyToIdMap[unshiftedValue] = id;
            unshiftedToShiftedMap[unshiftedValue] = keyValue;

        }
        keyboardElement.appendChild(rowElement);
    }
}

init();

