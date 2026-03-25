import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;

  audioContext!: AudioContext;
  gainNode!: GainNode;
  source: MediaElementAudioSourceNode | null = null;

  isPlaying = false;
  currentEmotion = '';

  async ngOnInit(): Promise<void> {
    await this.loadModels();
    this.initAudio();
    this.startVideo();
  }

  async loadModels(): Promise<void> {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models');
    await faceapi.nets.faceExpressionNet.loadFromUri('/assets/models');
  }

  initAudio(): void {
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }

  startVideo(): void {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        this.videoRef.nativeElement.srcObject = stream;
        this.detectFace();
      })
      .catch((error) => {
        console.error('Could not access camera.', error);
      });
  }

  detectFace(): void {
    setInterval(async () => {
      const detection = await faceapi
        .detectSingleFace(
          this.videoRef.nativeElement,
          new faceapi.TinyFaceDetectorOptions(),
        )
        .withFaceExpressions();

      if (detection) {
        this.handleExpression(detection.expressions);
      } else {
        this.stopSound();
      }
    }, 300);
  }

  handleExpression(exp: faceapi.FaceExpressions): void {
    const { happy, angry, sad, surprised } = exp;
    const intensity = Math.max(happy, angry, sad, surprised);

    if (intensity > 0.6) {
      const emotion =
        happy > 0.6
          ? 'happy'
          : angry > 0.6
            ? 'angry'
            : sad > 0.6
              ? 'sad'
              : 'surprised';

      if (!this.isPlaying || this.currentEmotion !== emotion) {
        this.startSound(emotion);
      }

      this.gainNode.gain.value = intensity;
    } else {
      this.stopSound();
    }
  }

  startSound(emotion: string): void {
    this.stopSound();

    const audio = new Audio(`assets/sounds/${emotion}.mp3`);
    this.source = this.audioContext.createMediaElementSource(audio);
    this.source.connect(this.gainNode);

    audio.loop = true;
    void audio.play();

    this.isPlaying = true;
    this.currentEmotion = emotion;
  }

  stopSound(): void {
    if (!this.isPlaying) {
      return;
    }

    const now = this.audioContext.currentTime;
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
    this.gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

    setTimeout(() => {
      this.isPlaying = false;
    }, 1500);
  }
}
