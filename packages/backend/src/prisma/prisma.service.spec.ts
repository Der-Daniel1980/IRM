import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

// ─── Mock-Strategie ──────────────────────────────────────────────────────────
//
// PrismaService.nextSequenceNumber und nextMasterDataNumber nutzen intern
// this.$transaction(async (tx) => tx.$queryRaw<...>`...`).
//
// Wir testen diese Methoden, indem wir PrismaService partiell mocken:
// $transaction wird so gemockt, dass es die Callback-Funktion mit einem
// Fake-tx aufruft, der $queryRaw mit kontrollierten Werten antwortet.
//
// Wegen der komplexen Prisma-Überladungen von $transaction casten wir
// den mock-Callback auf `any`, um TypeScript-Fehler zu vermeiden.

// ─── Hilfstypen ───────────────────────────────────────────────────────────────

type SequenceRow = { next_val: bigint };
type TxCallback = (tx: { $queryRaw: jest.Mock }) => Promise<bigint>;

// Erzeugt eine $transaction-Implementierung, die einen Fake-tx mit
// dem angegebenen BigInt-Wert übergibt.
function makeTxMock(returnValue: bigint) {
  return jest
    .fn()
    .mockImplementation(async (fn: TxCallback) => {
      const fakeTx = {
        $queryRaw: jest.fn().mockResolvedValue([{ next_val: returnValue }] as SequenceRow[]),
      };
      return fn(fakeTx);
    });
}

// Erzeugt eine $transaction-Implementierung, die bei jedem Aufruf
// den Zähler inkrementiert und den neuen Wert zurückgibt.
function makeIncrementalTxMock() {
  let counter = 0;
  return jest
    .fn()
    .mockImplementation(async (fn: TxCallback) => {
      counter++;
      const fakeTx = {
        $queryRaw: jest.fn().mockResolvedValue([{ next_val: BigInt(counter) }] as SequenceRow[]),
      };
      return fn(fakeTx);
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PrismaService', () => {
  let service: PrismaService;

  // Wir erstellen eine Test-Instanz, die KEINE echte DB-Verbindung aufbaut.
  // onModuleInit ($connect) wird durch Jest-Mock überblendet.
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);

    // Verhindere echte DB-Verbindung
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service as any, '$connect').mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service as any, '$disconnect').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── nextSequenceNumber ───────────────────────────────────────────────────

  describe('nextSequenceNumber', () => {
    it('gibt Format YYYY-TNNNNNNNN zurück', async () => {
      // T=1 (Auftrag), Sequenz-Wert = 1 => "2026-10000001"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).$transaction = makeTxMock(BigInt(1));

      const year = new Date().getFullYear();
      const result = await service.nextSequenceNumber(1);

      // Format: YYYY-TNNNNNNNN = Jahr-Typziffer + 7-stellige Nummer
      expect(result).toMatch(/^\d{4}-\d{8}$/);
      expect(result).toBe(`${year}-10000001`);
    });

    it('inkrement bei aufeinanderfolgenden Aufrufen', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).$transaction = makeIncrementalTxMock();

      const year = new Date().getFullYear();
      const first = await service.nextSequenceNumber(1);
      const second = await service.nextSequenceNumber(1);

      expect(first).toBe(`${year}-10000001`);
      expect(second).toBe(`${year}-10000002`);
    });

    it('unterstützt verschiedene Typziffern (T=1 Auftrag, T=2 Laufzettel, T=3 Wartung)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).$transaction = makeTxMock(BigInt(1));

      const year = new Date().getFullYear();

      const auftrag = await service.nextSequenceNumber(1);
      const laufzettel = await service.nextSequenceNumber(2);
      const wartung = await service.nextSequenceNumber(3);

      expect(auftrag).toBe(`${year}-10000001`);
      expect(laufzettel).toBe(`${year}-20000001`);
      expect(wartung).toBe(`${year}-30000001`);
    });

    it('polstert die Sequenznummer auf 7 Stellen', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).$transaction = makeTxMock(BigInt(42));

      const year = new Date().getFullYear();
      const result = await service.nextSequenceNumber(1);

      // 42 padded to 7 digits: 0000042
      expect(result).toBe(`${year}-10000042`);
    });
  });

  // ─── nextMasterDataNumber ─────────────────────────────────────────────────

  describe('nextMasterDataNumber', () => {
    it('K-0000001 Format', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).$transaction = makeTxMock(BigInt(1));

      const result = await service.nextMasterDataNumber('K');

      expect(result).toBe('K-0000001');
    });

    it('OBJ-0000001 Format', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).$transaction = makeTxMock(BigInt(1));

      const result = await service.nextMasterDataNumber('OBJ');

      expect(result).toBe('OBJ-0000001');
    });

    it('MA-0001 mit padLength=4', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).$transaction = makeTxMock(BigInt(1));

      const result = await service.nextMasterDataNumber('MA', 4);

      expect(result).toBe('MA-0001');
    });

    it('GER-0001 mit padLength=4', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).$transaction = makeTxMock(BigInt(1));

      const result = await service.nextMasterDataNumber('GER', 4);

      expect(result).toBe('GER-0001');
    });

    it('inkrement bei aufeinanderfolgenden Aufrufen', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).$transaction = makeIncrementalTxMock();

      const first = await service.nextMasterDataNumber('K');
      const second = await service.nextMasterDataNumber('K');
      const third = await service.nextMasterDataNumber('K');

      expect(first).toBe('K-0000001');
      expect(second).toBe('K-0000002');
      expect(third).toBe('K-0000003');
    });

    it('polstert größere Zahlen korrekt', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).$transaction = makeTxMock(BigInt(9999999));

      const result = await service.nextMasterDataNumber('K');
      expect(result).toBe('K-9999999');
    });

    it('Concurrency-Simulation: unabhängige Aufrufe erhalten verschiedene Nummern', async () => {
      // Simuliert atomare Vergabe: jeder $transaction-Aufruf erhält den nächsten Wert
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).$transaction = makeIncrementalTxMock();

      // 5 parallele Anfragen
      const promises = Array.from({ length: 5 }, () =>
        service.nextMasterDataNumber('K'),
      );
      const results = await Promise.all(promises);

      // Alle Nummern müssen eindeutig sein
      const unique = new Set(results);
      expect(unique.size).toBe(5);

      // Alle Nummern müssen das korrekte Format haben
      for (const num of results) {
        expect(num).toMatch(/^K-\d{7}$/);
      }
    });
  });
});
