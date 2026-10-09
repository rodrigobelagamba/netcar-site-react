import { Router } from 'express';
import { equipmentService, EquipmentError } from '../services/equipment.js';

export function createEquipmentRouter(service = equipmentService) {
  const router = Router();
  const respond = (handler) => (req, res) => {
    try { handler(req, res); } catch (error) {
      res.status(error instanceof EquipmentError ? error.status : 503).json({
        error: error instanceof EquipmentError ? error.message : 'Equipamentos indisponíveis. Verifique o estado da rotina.',
        ...(error instanceof EquipmentError && error.job ? { job: error.job } : {}),
      });
    }
  };
  router.get('/', respond((_req, res) => res.json(service.getState())));
  router.post('/run', respond((req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)
      throw new EquipmentError(400, 'Envie um objeto vazio para executar a auditoria.');
    res.status(202).json({ job: service.run() });
  }));
  router.post('/schedule', respond((req, res) => {
    if (!req.body || Object.keys(req.body).some((key) => key !== 'enabled'))
      throw new EquipmentError(400, 'Configuração inválida.');
    res.json({ schedule: service.setSchedule(req.body.enabled) });
  }));
  router.post('/reviews', respond((req, res) => {
    if (!req.body || Object.keys(req.body).some((key) => !['reviewKey', 'status', 'note', 'sourceUrl'].includes(key)))
      throw new EquipmentError(400, 'Campos de revisão inválidos.');
    res.json({ reviewKey: req.body.reviewKey, review: service.review(req.body) });
  }));
  router.post('/research/decisions', respond((req, res) => {
    res.status(202).json({ job: service.decideResearch(req.body) });
  }));
  return router;
}

export const equipmentRouter = createEquipmentRouter();
