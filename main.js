const axios = require("axios");
const https = require("https");
const cheerio = require("cheerio");
const fs = require("fs");

const ICONS = {
  "Spellicon A.png": "boot",
  "Spellicon B.png": "eye",
  "Spellicon C.png": "redHand",
  "Spellicon D.png": "redBrain",
  "Spellicon E.png": "pox",
  "Spellicon F.png": "water",
  "Spellicon G.png": "reaper",
  "Spellicon H.png": "blueBrain",
  "Spellicon I.png": "redArm",
  "Spellicon J.png": "blueHand",
  "Spellicon K.png": "shield",
  "Spellicon L.png": "summon",
  "Spellicon M.png": "cyclone",
  "Spellicon N.png": "dagger",
  "Spellicon O.png": "fire",
  "Spellicon P.png": "plant",
  "Spellicon Q.png": "earth",
  "Spellicon R.png": "blueArm",
  "Spellicon S.png": "snowflake",
  "Spellicon T.png": "wolf",
  "Spellicon U.png": "magic",
  "Spellicon V.png": "gate"
};

function writeToFile(filename, data) {
  const fullPath = `data/${filename}.json`;
  fs.writeFile(fullPath, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(`Successfully written data to ${fullPath}`);
  });
}

async function scrapeData(className) {
  const url = `https://wiki.project1999.com/${className}`;
  const spellUrls = [];
  const spells = {};

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  try {
    const { data: classReq } = await axios.get(url, { httpsAgent });
    const classPage = cheerio.load(classReq);

    //go to class page, get all the spell links
    //doesn't work for wizards and sks
    const spellLinks = classPage('table[width="92%"] td[width="22%"] a');
    spellLinks.each((idx, el) => {
      let href = el.attribs.href;
      if(href === '/Sacrifice') {
        href += '_(spell)';  
      }
      spellUrls.push(`https://wiki.project1999.com${href}`)
    });

    for(const spellUrl of spellUrls) {
      const { data: spellReq } = await axios.get(spellUrl, { httpsAgent });
      const spellPage = cheerio.load(spellReq);
      const spellName = spellPage('#firstHeading span').text();
      const spellThumbnail = spellPage('.thumbborder')[0].attribs.alt;
      const spellTables = spellPage('table:not([class])');
      const spellMeta = spellPage(spellTables[1]).find('td');
      const spellEffects = spellPage(spellTables[2]).find('td');
      console.log("grabbing ", spellName);
      const spell = {
        name: spellName,
        mana: spellPage(spellMeta[1]).text().trim(),
        skill: spellPage(spellMeta[3]).text().trim(),
        castTime: spellPage(spellMeta[5]).text().trim(),
        recastTime: spellPage(spellMeta[7]).text().trim(),
        fizzleTime: spellPage(spellMeta[9]).text().trim(),
        resist: spellPage(spellMeta[11]).text().trim(),
        range: spellPage(spellMeta[13]).text().trim(),
        targetType: spellPage(spellMeta[15]).text().trim(),
        spellType: spellPage(spellMeta[17]).text().trim(),
        duration: processDurationString(spellPage(spellMeta[19]).text().trim()),
        castOnYou: spellPage(spellEffects[1]).text().trim(),
        castOnOther: cleanTargetString(spellPage(spellEffects[3]).text().trim()),
        wearsOff: spellPage(spellEffects[5]).text().trim(),
        icon: ICONS[spellThumbnail]
      }

      // console.log(`pushing ${spellName}`);
      spells[spellName] = spell;
    };

    writeToFile(className, spells);
  } catch (err) {
    console.error(err);
  }
}

function fixDurations (className) {
  try {
    const fileData = fs.readFileSync(`data/${className}.json`, 'utf8');
    const spells = JSON.parse(fileData);
    for (spell in spells) {
      //can be "someone" or "someone 's"
      spells[spell].castOnOther = cleanTargetString(spells[spell].castOnOther);
      // const durationObj = processDurationString(spells[spell]['duration']);
      // spells[spell]['duration'] = durationObj;
    }
    writeToFile(`${className}`, spells)
  } catch (err) {
    console.error(err);
  }
}

// Instant
// N ticks/seconds/minutes/hours
// N minutes M seconds
// <S> @LN to <T> @LM
const timeUnits = {
  hour: 3600,
  hours: 3600,
  min: 60,
  minute: 60,
  mins: 60,
  minutes: 60,
  second: 1,
  seconds: 1,
  tick: 6,
  ticks: 6,
};

function processDurationString (durationString) {
  if(durationString === 'Instant') {
    return 0;
  }
  const tokens = durationString.split(' ');
  const durationObject = { durationString: durationString, minDuration: {} };
  let duration = 0;
  let runningTotal = 0;
  let currentKey = 'minDuration'
  for(const token of tokens) {
    const numToken = parseInt(token, 10);
    if(!isNaN(numToken)) {
      // token is a number
      runningTotal = token;
    } else if(timeUnits[token]) {
      // token is a time unit (hour, etc)
      const unit = timeUnits[token];
      runningTotal *= unit;
      duration += runningTotal;
      runningTotal = 0;
      durationObject[currentKey] = { duration: duration };
    } else if(token.includes('@')) {
      durationObject[currentKey].level = parseInt(token.replace('@L', ''), 10);
    } else if (token === 'to') {
      currentKey = 'maxDuration';
      duration = 0;
      durationObject[currentKey] = {};
    }
  }
  return durationObject;
}

function cleanTargetString (inString) {
  return inString.split(' ').slice(1).join(' ').trim();
}

async function main () {
  const classes = ['Cleric', 'Druid', 'Enchanter', 'Magician', 'Necromancer', 'Paladin', 'Ranger', 'Shaman'];
  for(const className of classes) {
    // fixDurations(className);
    // console.log('~~~~~~~~~~~~~~~~processing ', className);
    // await scrapeData(className);
  }
  scrapeData("Necromancer");
  // processDurationString("15 minutes @L5 to 20 minutes @L7");
  // processDurationString("18 seconds @L5 to 48 seconds @L14");
  // processDurationString("27 minutes 6 seconds");
  // processDurationString("9 ticks @L9 to 6.5 minutes @L65");
  // processDurationString("27 minutes @L9 to 3 hours 15 minutes @L60");
}
main();