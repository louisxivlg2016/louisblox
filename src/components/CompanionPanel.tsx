import { useEffect, useState } from 'react';
import { useCompanionMenuStore } from '../game/companionMenu';
import { companionAnimalName, companionSchedule, wakeTamedAnimal } from '../game/taming';
import { Animal, AnimalRest, AnimalTame } from '../game/traits';
import { DAY_DURATION } from '../game/dayNight';
import { world } from '../game/world';
import { mountEntity } from '../game/vehicles';
import { requestPlay } from '../game/input';
import { translate } from '../game/language';

function duration(seconds: number) {
  if (seconds <= 0) return translate('maintenant', 'now');
  const days = Math.ceil(seconds / DAY_DURATION);
  return `${days} ${days > 1 ? translate('jours de jeu', 'game days') : translate('jour de jeu', 'game day')}`;
}

export function CompanionPanel() {
  const entity = useCompanionMenuStore((state) => state.entity);
  const open = useCompanionMenuStore((state) => state.open);
  const close = useCompanionMenuStore((state) => state.close);
  const [schedule, setSchedule] = useState<ReturnType<typeof companionSchedule>>(null);
  const [tame, setTame] = useState<{ friendship: number; happiness: number; baby: boolean } | null>(null);
  const [sleeping, setSleeping] = useState(false);
  useEffect(() => {
    if (!entity || !open) return;
    const update = () => {
      if (!entity.isAlive()) {
        close();
        return;
      }
      setSchedule(companionSchedule(world, entity));
      const current = entity.get(AnimalTame);
      if (current) setTame({ friendship: current.friendship, happiness: current.happiness, baby: current.baby });
      setSleeping(entity.get(AnimalRest)?.sleeping === true);
    };
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [entity, open, close]);

  if (!entity || !open) return null;
  const kind = entity.get(Animal)?.kind;
  if (!kind) return null;
  const resume = () => {
    close();
    void requestPlay();
  };
  const mount = () => {
    if (kind !== 'horse' && kind !== 'camel') return;
    if (!mountEntity(world, entity, kind)) return;
    resume();
  };
  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel companion-panel" role="dialog" aria-modal="true" aria-label={translate('Menu de ton animal', 'Your animal menu')} data-companion-menu>
        <div className="backpack-header"><h2>{companionAnimalName(kind)}</h2><button className="secondary-button" onClick={resume}>{translate('Fermer et reprendre', 'Close and resume')}</button></div>
        <div className="companion-schedule">
          <p><strong>{tame?.baby ? translate('Bébé', 'Baby') : translate('Adulte', 'Adult')}</strong> · {translate(`Amitié ${tame?.friendship ?? 1} · ${tame?.happiness ?? 100} %`, `Friendship ${tame?.friendship ?? 1} · ${tame?.happiness ?? 100}%`)}{sleeping && ` · ${translate('Endormi', 'Asleep')}`}</p>
          <p data-next-baby>{translate('Prochain bébé dans', 'Next baby in')} <strong>{duration(schedule?.nextBirthIn ?? 0)}</strong></p>
          {tame?.baby && schedule && schedule.growUpIn !== null && <p data-grow-up>{translate('Adulte dans', 'Adult in')} <strong>{duration(schedule.growUpIn)}</strong></p>}
          {kind === 'cow' && schedule && schedule.nextGiftIn !== null && <p data-next-gift>{translate('Prochain lait dans', 'Next milk in')} <strong>{duration(schedule.nextGiftIn)}</strong></p>}
          {kind === 'sheep' && schedule && schedule.nextGiftIn !== null && <p data-next-gift>{translate('Prochaine laine dans', 'Next wool in')} <strong>{duration(schedule.nextGiftIn)}</strong></p>}
          {sleeping && <button type="button" className="primary-button" data-wake-companion onClick={() => { wakeTamedAnimal(world, entity); resume(); }}>{translate('Réveiller', 'Wake up')}</button>}
          {!sleeping && (kind === 'horse' || kind === 'camel') && <button type="button" className="primary-button" data-mount-companion onClick={mount}>{kind === 'horse' ? translate('Monter à cheval sans selle', 'Ride horse without a saddle') : translate('Monter sur le chameau sans selle', 'Ride camel without a saddle')}</button>}
        </div>
      </section>
    </div>
  );
}
