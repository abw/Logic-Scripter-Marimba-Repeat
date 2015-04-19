//------------------------------------------------------------------------------
// Marimba repeat script for Logix Pro X / Mainstage 3 Midi FX Scripter Plugin
//
// This script replicates the marimba repeat effect on the Lowrey Berkshire
// Deluxe TBO-1 organ that Pete Townsend used in Baba O'Riley.
//
// It acts like a simple repeater but with a twist.  Holding down any of the
// notes F, F#, G, B, C and C# will cause the note to be repeated on the beat
// The other notes, G#, A, A#, D, D# and E are repeated off the beat.
//
// Written by Andy Wardley <abw@wardley.org> April 2015
//-----------------------------------------------------------------------

NeedsTimingInfo = true;

var DEBUG         = false,
    MINUTE_MS     = 60000,
    timing        = { },
    notesOnBeat   = { },
    notesOffBeat  = { },
    notesOffSent  = false,
    notesOn       = 0,
    lastBar       = false,
    divisionNames = [
        "1/16 triplets", "1/16", "1/16 dotted",
        "1/8 triplets", "1/8", "1/8 dotted",
        "1/4 triplets", "1/4", "1/4 dotted",
        "1/2 triplets", "1/2", "1/2 dotted"
    ],
    divisionBeats = [
        .166, .25, .375,  // 1/16t, 1/16, 1/16d
        .333, .5, .75,    // 1/8t, 1/8, 1/8d
        .666, 1, 1.5,     // 1/4t, 1/4, 1/4d
        1.333, 2, 3       // 1/2t, 1/2, 1/2d
    ];

var timing = {
    ticked: 0,
    tick:   false,
    tock:   false
};

var PluginParameters = [
    {
        name:           "Time",
        type:           "menu",
        numberOfSteps:  11,
        defaultValue:   1,
        valueStrings:   divisionNames
    },
    {
        name:           "Note Length",
        type:           "linear",
        unit:           "%",
        minValue:       1,
        maxValue:       100,
        numberOfSteps:  99,
        defaultValue:   50
    }
    //,
    //{
    //    name:           "Tempo Match",
    //    type:           "linear",
    //    defaultValue:   100,
    //    minValue:       0,
    //    maxValue:       100,
    //    numberOfSteps:  100,
    //    unit:           "%"
    //},
    //{
    //    name:           "Min. Tolerance",
    //    type:           "linear",
    //    defaultValue:   5,
    //    minValue:       0,
    //    maxValue:       49,
    //    numberOfSteps:  49,
    //    unit:           "%"
    //},
    //{
    //    name:           "Max. Tolerance",
    //    type:           "linear",
    //    defaultValue:   30,
    //    minValue:       0,
    //    maxValue:       49,
    //    numberOfSteps:  49,
    //    unit:           "%"
    //}
];

//-------------------------------------------------------------
// HandleMIDI(e)
//-------------------------------------------------------------

function HandleMIDI(e) {
    if (e instanceof NoteOn) {
        noteOn(e);
    }
    else if (e instanceof NoteOff) {
        noteOff(e);
    }
    else {
        e.send();
    }
}

//-------------------------------------------------------------
// ProcessMIDI()
//-------------------------------------------------------------

function ProcessMIDI() {
    var t = tick();

    if (t.info.playing && notesOffSent) {
        notesOffSent = false;
    }
    if (! t.info.playing && ! notesOffSent) {
        MIDI.allNotesOff();
        notesOffSent = true;
    }

    if (t.tick) {
        //debug('tick');
        triggerNotes(notesOnBeat);
    }
    else if (t.tock) {
        //debug('tock');
        triggerNotes(notesOffBeat);
    }
}


//-------------------------------------------------------------
// tick()
//-------------------------------------------------------------

function tick() {
    var divn  = timing.divn  = divisionBeats[ GetParameter("Time") ],
        info  = timing.info  = GetTimingInfo(),
        tempo = timing.tempo = info.tempo,
        bpm   = timing.bpm   = timing.bpm || tempo,
        spm   = timing.spm   = bpm / divn,
        beat  = timing.beat  = MINUTE_MS / bpm,
        step  = timing.step  = MINUTE_MS / spm,
        half  = timing.half  = step / 2,
        now   = timing.now   = new Date().getTime();

    //debug("divn:", divn, " tempo:", tempo, " bpm:", bpm, " spm:", spm, " beat:", beat, " step:", step);

    if (timing.ticked) {
        var diff = timing.diff = now - timing.ticked;

        if (diff > step) {
            timing.ticked = now;
            timing.tocked = false;
            timing.tick   = true;
            timing.diff   = 0;
        }
        else if (diff > half && ! timing.tocked) {
            timing.tocked   = now;
            timing.tock     = true;
        }
        else {
            timing.tick = false;
            timing.tock = false;
        }
    }
    else {
        timing.ticked = now;
        timing.tick   = true;
        timing.diff   = 0;
    }

    return timing;
}




//-------------------------------------------------------------
// Note On/Off
//-------------------------------------------------------------

function noteOn(e) {
    var notes = noteBeatGroup(e);

    //debug('ON: ', e );
    notes[e.pitch] = e.velocity;

    if (notesOn == 0) {
        firstNoteOn(e);
    }
    notesOn++;
    //checkTempo();
}

function firstNoteOn(e) {
    debug("FIRST NOTE ON: ", e);
    timing.bpm    = timing.tempo;
    timing.ticked = new Date().getTime();
    triggerNotes(notesOnBeat);
}

function noteOff(e) {
    var notes = noteBeatGroup(e);
    //debug('OFF: ', e);
    delete notes[e.pitch];
    notesOn--;
}

function NEW_checkTempo() {
    var t = tick(),
        d = t.now - lastBar,
        e = 60000 / t.bpm

}

function checkTempo() {
    var t = tick();
    return;
    if (! t.diff) return;

    var dt  = t.diff,
        rat = dt / t.beat,
        pc  = rat * 100,
        pc2 = 100 - pc,
        min = GetParameter("Min. Tolerance"),
        max = GetParameter("Max. Tolerance"),
        spm = false;


    if (pc > min && pc < max) {
        // note played after beat by more than min tolerance and less than max
        debug("AFTER beat (", pc, "%), slowing down");
        spm = 60000 / (t.beat + t.diff);
    }
    else if (pc2 > min && pc2 < max) {
        debug("BEFORE beat (", pc2, "%), speeding up");
        // note played before next beat by more than min tolerance and less than max
        spm = 60000 / t.diff;
    }
    else {
        return;
    }

    var new_bpm  = spm * t.divn,
        bpm_diff = new_bpm - t.bpm,
        match    = GetParameter("Tempo Match"),
        set_bpm  = t.bpm + (match * bpm_diff / 100);

    //debug("SPM ", t.spm , " -> ", spm);
    //debug("BPM ", t.bpm , " -> ", new_bpm);
    //debug("bpm diff: ", bpm_diff, "  tempo match: ", match, "  set bpm: ", set_bpm);
    debug("BPM ", t.bpm , " -> ", set_bpm);
    timing.bpm = set_bpm;
}


//-----------------------------------------------------------------
// Convert pitch to a number from 0 (F) to 11 (E) then divide by 3
// (integer division so discard remainder) to get the group number
// (1: F, F#, G; 2: G#, A, A#; 3: B, B#, C; 4: C#, D, E).  Then
// modulo 2 to get 0 for the 1st and 3rd groups (played on the beat)
// and 1 for the other (played off the beat).
//-----------------------------------------------------------------

function noteBeatOffset(e) {
    var p = e.pitch,
        f = (p - 5) % 12,      // semitones relative to F
        g = Math.floor(f / 3), // group of 3 semitones, F-G (0), G#-A# (1), etc
        s = g % 2;             // odd groups are syncopated
    return s;
}

function noteBeatGroup(e) {
    return noteBeatOffset(e)
        ? notesOffBeat
        : notesOnBeat;
}


function debug() {
    if (DEBUG) {
        Trace(
            Array.prototype.slice.call(arguments).join('')
        );
    }
}

function triggerNotes(notes) {
    var keys = Object.keys(notes),
        klen = keys.length,
        nlen = GetParameter("Note Length"),
        wait = timing.beat * nlen / 100;    // convert % of step to milliseconds

    //Trace(keys.length + ' keys on');
    for (var i = 0; i < klen; i++) {
        var pitch = keys[i],
            vel   = notes[pitch],
            on    = new NoteOn(),
            off   = new NoteOff();

        //debug('NOTE: ' + i + ' = ' + pitch + '  vel:' + vel + '  nlen:' + nlen + '  wait:' + wait);
        on.pitch = pitch;
        on.velocity = vel;
        off.pitch = pitch;
        on.send();
        off.sendAfterMilliseconds(wait);
    }
}
