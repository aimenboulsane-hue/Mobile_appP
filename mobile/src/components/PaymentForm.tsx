import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

import { Button } from './Button';
import { Input } from './Input';
import { Notice } from './States';

type Props = {
  amount: number;
  description: string;
  onPay: (cardLast4: string) => Promise<void>;
};

const PROCESSING_MS = 1200;

type Errors = { holder?: string; number?: string; expiry?: string; cvc?: string };

export function PaymentForm({ amount, description, onPay }: Props) {
  const [holder, setHolder] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const submitted = useRef(false);

  const digits = number.replace(/\D/g, '');

  const validate = (): Errors => {
    const found: Errors = {};
    if (holder.trim().length < 2) found.holder = 'Indiquez le nom du titulaire.';
    if (digits.length !== 16) found.number = 'Le numéro doit contenir 16 chiffres.';
    const [month, year] = expiry.split('/').map(Number);
    const now = new Date();
    const expired = year + 2000 < now.getFullYear()
      || (year + 2000 === now.getFullYear() && month < now.getMonth() + 1);
    if (!/^\d{2}\/\d{2}$/.test(expiry) || month < 1 || month > 12) found.expiry = 'Format attendu : MM/AA.';
    else if (expired) found.expiry = 'Cette carte est expirée.';
    if (!/^\d{3}$/.test(cvc)) found.cvc = '3 chiffres.';
    return found;
  };

  const pay = async () => {
    if (submitted.current) return;
    const found = validate();
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    submitted.current = true;
    setPaying(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, PROCESSING_MS));
      await onPay(digits.slice(-4));
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      submitted.current = false;
      setPaying(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.amountBox}>
        <Text style={styles.amountLabel} numberOfLines={2}>{description}</Text>
        <Text style={styles.amount}>{formatPrice(amount)}</Text>
      </View>

      <Notice tone="primary"
        message="Paiement simulé : utilisez des chiffres fictifs. Aucune donnée bancaire n'est envoyée ni enregistrée." />

      <Input label="Titulaire de la carte" icon="person-outline" placeholder="Nom et prénom"
        value={holder} onChangeText={setHolder} error={errors.holder} autoCapitalize="words"
        editable={!paying} />
      <Input label="Numéro de carte" icon="card-outline" placeholder="4242 4242 4242 4242"
        keyboardType="number-pad" maxLength={19} editable={!paying} error={errors.number}
        value={number}
        onChangeText={(text) => setNumber(text.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '))} />
      <View style={styles.row}>
        <View style={styles.half}>
          <Input label="Expiration" placeholder="MM/AA" keyboardType="number-pad" maxLength={5}
            editable={!paying} error={errors.expiry} value={expiry}
            onChangeText={(text) => {
              const d = text.replace(/\D/g, '').slice(0, 4);
              setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
            }} />
        </View>
        <View style={styles.half}>
          <Input label="CVC" placeholder="123" keyboardType="number-pad" maxLength={3} password
            editable={!paying} error={errors.cvc} value={cvc}
            onChangeText={(text) => setCvc(text.replace(/\D/g, ''))} />
        </View>
      </View>

      {serverError && <Notice message={serverError} />}
      <Button
        title={paying ? 'Traitement du paiement…' : `Payer ${formatPrice(amount)}`}
        icon="lock-closed"
        onPress={pay}
        loading={paying}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  amountLabel: { flex: 1, fontSize: fontSize.md, color: colors.textSecondary },
  amount: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
});
