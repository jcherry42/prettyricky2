import { PttOverlay } from './PttOverlay';

export default PttOverlay;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    width: '100%',
    alignItems: 'center',
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.0,
  },
  langBadge: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
  },
  body: {
    marginTop: 10,
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  holdBtn: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.40)',
    backgroundColor: 'rgba(126,34,206,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdBtnRec: {
    borderColor: 'rgba(255,45,45,0.55)',
    backgroundColor: 'rgba(255,45,45,0.12)',
  },
  holdBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  section: {
    color: colors.textMute,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardText: {
    marginTop: 6,
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  btn: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  close: {
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(0,0,0,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.textMute,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
});
