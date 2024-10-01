class FourierToneAnalyzer {
    constructor() {
        this.startButton = document.getElementById('startRecording');
        this.inputCanvas = document.getElementById('inputStrengthCanvas');
        this.inputCanvasContext = this.inputCanvas.getContext('2d');
        this.frequencyCanvas = document.getElementById('frequencyCanvas');
        this.frequencyCanvasContext = this.frequencyCanvas.getContext('2d');
        this.recordingEndTimeDiv = document.getElementById('recordingEndTime');

        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.frequencyData = null;
        this.timeDomainData = null;
        this.mediaStream = null;
        this.isRecording = false;
        this.recordingDuration = 10; // 秒

        this.notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.octaves = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
        this.noteColors = {
            'C': '#E57373', 'C#': '#FF8A65', 'D': '#FFB74D', 'D#': '#FFD54F',
            'E': '#FFF176', 'F': '#AED581', 'F#': '#81C784', 'G': '#4DD0E1',
            'G#': '#4FC3F7', 'A': '#7986CB', 'A#': '#BA68C8', 'B': '#F06292'
        };

        this.frequencies = this.calculateFrequencies();
        this.init();
    }

    init() {
        this.startButton.addEventListener('click', () => this.startRecording());
        this.resizeCanvases();
        this.drawAxisLabels();
    }

    resizeCanvases() {
        this.inputCanvas.width = 300;
        this.inputCanvas.height = 100;
        this.frequencyCanvas.width = 350;
        this.frequencyCanvas.height = 400;
        this.drawAxisLabels();
    }

    calculateFrequencies() {
        let frequencies = [];
        this.octaves.forEach(octave => {
            this.notes.forEach((note) => {
                const frequency = 16.35 * Math.pow(2, octave + this.notes.indexOf(note) / 12);
                frequencies.push({ note: note + octave, frequency: frequency, color: this.noteColors[note], baseNote: note });
            });
        });
        return frequencies;
    }

    drawAxisLabels() {
        const rows = 12;
        const cols = this.octaves.length + 1;
        const barWidth = (this.frequencyCanvas.width - 60) / cols;
        const barHeightUnit = (this.frequencyCanvas.height - 40) / rows;

        this.frequencyCanvasContext.clearRect(0, 0, this.frequencyCanvas.width, this.frequencyCanvas.height);
        this.frequencyCanvasContext.font = '14px Noto Sans JP';
        this.frequencyCanvasContext.fillStyle = '#595959';
        this.frequencyCanvasContext.textBaseline = 'middle';
        for (let row = 0; row < rows; row++) {
            this.frequencyCanvasContext.fillText(
                this.notes[row % 12],
                10,
                row * barHeightUnit + barHeightUnit / 2 + 20
            );
        }

        this.frequencyCanvasContext.font = '10px Noto Sans JP';
        this.frequencyCanvasContext.textAlign = 'center';
        this.frequencyCanvasContext.fillText('OALL', barWidth / 2 + 40, this.frequencyCanvas.height - 10);
        for (let col = 1; col < cols; col++) {
            this.frequencyCanvasContext.fillText(`O${9 - col + 1}`, col * barWidth + barWidth / 2 + 40, this.frequencyCanvas.height - 10);
        }
    }

    startRecording() {
        if (this.isRecording) return;
        this.isRecording = true;
        this.startButton.disabled = true;
        this.startButton.textContent = 'マイクにアクセス中...';
        this.drawAxisLabels();
        this.recordingEndTimeDiv.textContent = '';

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => this.handleStream(stream))
            .catch(err => this.handleError(err));
    }

    handleStream(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.microphone = this.audioContext.createMediaStreamSource(stream);
        this.microphone.connect(this.analyser);

        this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
        this.timeDomainData = new Uint8Array(this.analyser.fftSize);
        this.mediaStream = stream;

        let remainingTime = this.recordingDuration;
        this.startButton.textContent = `録音中... 残り ${remainingTime} 秒`;

        const countdownInterval = setInterval(() => {
            remainingTime -= 1;
            if (remainingTime >= 0) {
                this.startButton.textContent = `録音中... 残り ${remainingTime} 秒`;
            }
        }, 1000);

        const inputStrengthInterval = setInterval(() => {
            this.analyser.getByteTimeDomainData(this.timeDomainData);
            this.drawInputStrength(this.timeDomainData);
        }, 30);

        setTimeout(() => {
            clearInterval(inputStrengthInterval);
            clearInterval(countdownInterval);
            this.startButton.textContent = `録音完了`;
            this.analyser.getFloatFrequencyData(this.frequencyData);
            const strengths = this.calculateNoteStrengths();
            this.drawNoteStrengths(strengths);
            this.displayRecordingEndTime();
            this.stopRecording();
        }, this.recordingDuration * 1000);
    }

    handleError(err) {
        console.error("マイクのアクセスに失敗しました: " + err);
        this.isRecording = false;
        this.startButton.disabled = false;
        this.startButton.textContent = "録音開始";
    }

    stopRecording() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        this.isRecording = false;
        this.startButton.disabled = false;
        this.startButton.textContent = "録音開始";
    }

    drawInputStrength(timeDomainData) {
        this.inputCanvasContext.clearRect(0, 0, this.inputCanvas.width, this.inputCanvas.height);
        this.inputCanvasContext.lineWidth = 2;
        this.inputCanvasContext.strokeStyle = 'rgb(0, 102, 204)';
        this.inputCanvasContext.beginPath();

        const sliceWidth = this.inputCanvas.width / timeDomainData.length;
        let x = 0;

        for (let i = 0; i < timeDomainData.length; i++) {
            const v = timeDomainData[i] / 128.0;
            const y = v * this.inputCanvas.height / 2;

            if (i === 0) {
                this.inputCanvasContext.moveTo(x, y);
            } else {
                this.inputCanvasContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.inputCanvasContext.lineTo(this.inputCanvas.width, this.inputCanvas.height / 2);
        this.inputCanvasContext.stroke();
    }

    calculateNoteStrengths() {
        const sampleRate = this.audioContext.sampleRate;
        const nyquist = sampleRate / 2;
        const binSize = nyquist / this.frequencyData.length;

        const strengths = this.frequencies.map(f => {
            const targetFrequency = f.frequency;
            const index = Math.round(targetFrequency / binSize);
            const decibel = this.frequencyData[index] || -Infinity;
            return {
                note: f.note,
                baseNote: f.baseNote,
                strength: decibel,
                color: f.color
            };
        });

        const totalStrengths = this.notes.map(note => {
            const noteStrengths = strengths.filter(s => s.baseNote === note).map(s => s.strength);
            const totalStrength = noteStrengths.reduce((a, b) => a + Math.pow(10, b / 10), 0);
            const avgDecibel = 10 * Math.log10(totalStrength);
            return {
                note: note,
                strength: avgDecibel,
                color: this.noteColors[note]
            };
        });

        return { strengths, totalStrengths };
    }

    drawNoteStrengths({ strengths, totalStrengths }) {
        const rows = 12;
        const cols = this.octaves.length + 1;
        const barWidth = (this.frequencyCanvas.width - 60) / cols;
        const barHeightUnit = (this.frequencyCanvas.height - 40) / rows;

        this.drawAxisLabels();

        const minDb = -140;
        const maxDb = -30;

        for (let row = 0; row < rows; row++) {
            const note = this.notes[11 - row];

            const totalStrength = totalStrengths.find(s => s.note === note);
            const normalizedTotalStrength = (totalStrength.strength - minDb) / (maxDb - minDb);
            const clampedTotalStrength = Math.max(0, Math.min(1, normalizedTotalStrength));
            const totalHeight = clampedTotalStrength * barHeightUnit;
            const xTotal = 40;
            const y = row * barHeightUnit + 20;

            this.frequencyCanvasContext.fillStyle = totalStrength.color;
            this.frequencyCanvasContext.fillRect(
                xTotal,
                y + (barHeightUnit - totalHeight),
                barWidth - 2,
                totalHeight
            );

            this.frequencyCanvasContext.font = '8px Noto Sans JP';
            this.frequencyCanvasContext.fillStyle = '#595959';
            this.frequencyCanvasContext.fillText(
                totalStrength.strength.toFixed(1),
                xTotal + (barWidth - 2) / 2,
                y + barHeightUnit - 5
            );

            for (let col = 1; col < cols; col++) {
                const octave = this.octaves[col - 1];
                const noteStrength = strengths.find(s => s.note === note + octave);
                const normalizedStrength = (noteStrength.strength - minDb) / (maxDb - minDb);
                const clampedStrength = Math.max(0, Math.min(1, normalizedStrength));
                const height = clampedStrength * barHeightUnit;
                const x = col * barWidth + 40;

                this.frequencyCanvasContext.fillStyle = noteStrength.color;
                this.frequencyCanvasContext.fillRect(
                    x,
                    y + (barHeightUnit - height),
                    barWidth - 2,
                    height
                );

                this.frequencyCanvasContext.font = '8px Noto Sans JP';
                this.frequencyCanvasContext.fillStyle = '#595959';
                this.frequencyCanvasContext.fillText(
                    noteStrength.strength.toFixed(1),
                    x + (barWidth - 2) / 2,
                    y + barHeightUnit - 5
                );
            }
        }
    }

    displayRecordingEndTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = ('0' + (now.getMonth() + 1)).slice(-2);
        const day = ('0' + now.getDate()).slice(-2);
        const hours = ('0' + now.getHours()).slice(-2);
        const minutes = ('0' + now.getMinutes()).slice(-2);
        const seconds = ('0' + now.getSeconds()).slice(-2);
        const formattedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        this.recordingEndTimeDiv.style.color = '#999999';
        this.recordingEndTimeDiv.style.fontSize = '12px';
        this.recordingEndTimeDiv.textContent = `recorded at (${formattedTime})`;
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    const analyzer = new FourierToneAnalyzer();
});
