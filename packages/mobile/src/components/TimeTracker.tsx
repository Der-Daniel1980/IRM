import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text, TextInput, Surface } from 'react-native-paper';
import { useStartWork, useStopWork, useSubmitTimeEntry } from '../hooks/useMyOrders';

interface TimeTrackerProps {
  orderId: string;
  orderStatus: string;
  actualStart: string | null;
  actualDurationMin: number | null;
}

export function TimeTracker({
  orderId,
  orderStatus,
  actualStart,
  actualDurationMin,
}: TimeTrackerProps) {
  const startWork = useStartWork();
  const stopWork = useStopWork();
  const submitTimeEntry = useSubmitTimeEntry();

  const [elapsed, setElapsed] = useState(0);
  const [completionNotes, setCompletionNotes] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualDuration, setManualDuration] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isInProgress = orderStatus === 'IN_PROGRESS';
  const isCompleted = orderStatus === 'COMPLETED';
  const canStart = ['PLANNED', 'ASSIGNED'].includes(orderStatus);

  // Timer aktualisieren
  useEffect(() => {
    if (isInProgress && actualStart) {
      const start = new Date(actualStart).getTime();
      const update = () => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      };
      update();
      intervalRef.current = setInterval(update, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [isInProgress, actualStart]);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    Alert.alert('Arbeit starten', 'Möchten Sie die Arbeit an diesem Auftrag beginnen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Starten',
        onPress: () => startWork.mutate(orderId),
      },
    ]);
  };

  const handleStop = () => {
    Alert.alert(
      'Arbeit beenden',
      'Möchten Sie den Auftrag als erledigt melden?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Beenden',
          onPress: () =>
            stopWork.mutate({
              orderId,
              completionNotes: completionNotes || undefined,
            }),
        },
      ],
    );
  };

  const handleManualSubmit = () => {
    const duration = parseInt(manualDuration, 10);
    if (!duration || duration <= 0) {
      Alert.alert('Fehler', 'Bitte geben Sie eine gültige Dauer ein.');
      return;
    }

    const now = new Date();
    const startAt = new Date(now.getTime() - duration * 60000);

    submitTimeEntry.mutate(
      {
        orderId,
        startedAt: startAt.toISOString(),
        endedAt: now.toISOString(),
        durationMin: duration,
        notes: manualNotes || undefined,
      },
      {
        onSuccess: () => {
          setManualDuration('');
          setManualNotes('');
          setShowManual(false);
          Alert.alert('Erfolg', 'Zeiteintrag wurde gespeichert.');
        },
      },
    );
  };

  if (isCompleted) {
    return (
      <Surface style={styles.container} elevation={1}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Zeiterfassung
        </Text>
        <View style={styles.completedRow}>
          <Text variant="bodyMedium" style={styles.completedLabel}>
            Tatsächliche Dauer:
          </Text>
          <Text variant="titleMedium" style={styles.completedValue}>
            {actualDurationMin ? `${actualDurationMin} Min.` : '—'}
          </Text>
        </View>
      </Surface>
    );
  }

  return (
    <Surface style={styles.container} elevation={1}>
      <Text variant="titleSmall" style={styles.sectionTitle}>
        Zeiterfassung
      </Text>

      {/* Live-Timer */}
      {isInProgress && (
        <View style={styles.timerSection}>
          <Text variant="displaySmall" style={styles.timer}>
            {formatTime(elapsed)}
          </Text>
          <TextInput
            label="Abschlussnotizen (optional)"
            value={completionNotes}
            onChangeText={setCompletionNotes}
            mode="outlined"
            multiline
            numberOfLines={2}
            style={styles.notesInput}
          />
          <Button
            mode="contained"
            onPress={handleStop}
            loading={stopWork.isPending}
            disabled={stopWork.isPending}
            buttonColor="#059669"
            icon="stop-circle-outline"
            style={styles.button}
          >
            Arbeit beenden
          </Button>
        </View>
      )}

      {/* Start-Button */}
      {canStart && (
        <Button
          mode="contained"
          onPress={handleStart}
          loading={startWork.isPending}
          disabled={startWork.isPending}
          icon="play-circle-outline"
          style={styles.button}
        >
          Arbeit starten
        </Button>
      )}

      {/* Manuelle Eingabe */}
      {!isCompleted && (
        <>
          <Button
            mode="text"
            onPress={() => setShowManual(!showManual)}
            icon={showManual ? 'chevron-up' : 'clock-plus-outline'}
            compact
            style={styles.manualToggle}
          >
            {showManual ? 'Manuell ausblenden' : 'Manuell eintragen'}
          </Button>

          {showManual && (
            <View style={styles.manualSection}>
              <TextInput
                label="Dauer in Minuten"
                value={manualDuration}
                onChangeText={setManualDuration}
                mode="outlined"
                keyboardType="number-pad"
                style={styles.durationInput}
              />
              <TextInput
                label="Notizen (optional)"
                value={manualNotes}
                onChangeText={setManualNotes}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.notesInput}
              />
              <Button
                mode="outlined"
                onPress={handleManualSubmit}
                loading={submitTimeEntry.isPending}
                disabled={submitTimeEntry.isPending}
                icon="check"
              >
                Zeiteintrag speichern
              </Button>
            </View>
          )}
        </>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    color: '#1e293b',
  },
  timerSection: {
    alignItems: 'center',
  },
  timer: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#d97706',
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  notesInput: {
    width: '100%',
    marginBottom: 8,
  },
  durationInput: {
    marginBottom: 8,
  },
  manualToggle: {
    marginTop: 12,
  },
  manualSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  completedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completedLabel: {
    color: '#64748b',
  },
  completedValue: {
    fontWeight: '600',
    color: '#059669',
  },
});
