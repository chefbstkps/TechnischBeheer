import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { OrganisationService } from '../services/organisationService';
import { BrandsService } from '../services/brandsService';
import { capitalizeFirst } from '../utils/string';
import type { VehicleWithRelations } from '../types/database';
import './VehicleForm.css';

const VERZEKERD_OPTIONS = ['Self-Reliance', 'Assuria', 'Parsasco', 'Fatum'];
const VERZEKERTYPE_OPTIONS = ['WA', 'Mini Casco', 'Casco'];
const SOORT_OPTIONS = ['Sedan', 'Pickup', 'SUV', 'Station', 'Bus', 'Truck'];

interface VehicleFormProps {
  structures: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  error?: string | null;
  createLoading?: boolean;
  /** Bij bewerken: loading state voor opslaan */
  editLoading?: boolean;
  /** Bij bewerken: het bestaande voertuig om het formulier mee te vullen */
  initialVehicle?: VehicleWithRelations | null;
}

export default function VehicleForm({
  structures,
  brands,
  onClose,
  onSubmit,
  error,
  createLoading,
  editLoading,
  initialVehicle,
}: VehicleFormProps) {
  const isEdit = !!initialVehicle;
  const saveLoading = createLoading || editLoading;
  const initialFormState = {
    inzet: 'Burgerplaat',
    license_plate: '',
    structure_id: '',
    department_id: '',
    brand_id: '',
    model_id: '',
    merk: '',
    model: '',
    bouwjaar: new Date().getFullYear(),
    soort: '',
    transmissie: '',
    aandrijving: '',
    chassisnummer: '',
    verzekerd: '',
    verzekertype: '',
    polisnummer: '',
    start_datum: '',
    eind_datum: '',
    opmerking: '',
    status: 'Goed',
  };
  const [form, setForm] = useState<Record<string, unknown>>(initialFormState);
  const hasInitializedEdit = useRef(false);
  const initialVehicleIdRef = useRef<string | null>(null);
  const prevStructureIdRef = useRef<string | undefined>();
  const prevBrandIdRef = useRef<string | undefined>();

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => currentYear - i);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', form.structure_id],
    queryFn: () =>
      OrganisationService.listDepartments(form.structure_id as string),
    enabled: !!form.structure_id,
  });

  const { data: models = [] } = useQuery({
    queryKey: ['models', form.brand_id],
    queryFn: () => BrandsService.listModels(form.brand_id as string),
    enabled: !!form.brand_id,
  });

  useEffect(() => {
    if (!initialVehicle) {
      hasInitializedEdit.current = false;
      initialVehicleIdRef.current = null;
      return;
    }
    if (initialVehicleIdRef.current !== initialVehicle.id) {
      hasInitializedEdit.current = false;
      initialVehicleIdRef.current = initialVehicle.id;
    }
    if (hasInitializedEdit.current) return;
    hasInitializedEdit.current = true;
    const structure = initialVehicle.structure as { id?: string } | undefined;
    const department = initialVehicle.department as { id?: string } | undefined;
    const brand = brands.find((b) => b.name === initialVehicle.merk);
    const verzekerd =
      VERZEKERD_OPTIONS.find(
        (o) => o.toLowerCase() === (initialVehicle.verzekerd ?? '').toLowerCase()
      ) ?? '';
    const verzekertype =
      VERZEKERTYPE_OPTIONS.find(
        (o) => o.toLowerCase() === (initialVehicle.verzekertype ?? '').toLowerCase()
      ) ?? '';
    const sid = structure?.id ?? '';
    const bid = brand?.id ?? '';
    setForm({
      inzet: capitalizeFirst(initialVehicle.inzet),
      license_plate: initialVehicle.license_plate,
      structure_id: sid,
      department_id: department?.id ?? '',
      brand_id: bid,
      model_id: '',
      merk: initialVehicle.merk,
      model: initialVehicle.model,
      bouwjaar: initialVehicle.bouwjaar ?? currentYear,
      soort:
        SOORT_OPTIONS.find(
          (o) => o.toLowerCase() === (initialVehicle.soort ?? '').toLowerCase()
        ) ?? '',
      transmissie: initialVehicle.transmissie ?? '',
      aandrijving: initialVehicle.aandrijving ?? '',
      chassisnummer: (initialVehicle as { chassisnummer?: string | null }).chassisnummer ?? '',
      verzekerd,
      verzekertype,
      polisnummer: (initialVehicle as { polisnummer?: string | null }).polisnummer ?? '',
      start_datum: initialVehicle.start_datum ?? '',
      eind_datum: initialVehicle.eind_datum ?? '',
      opmerking: initialVehicle.opmerking ?? '',
      status: initialVehicle.status ? capitalizeFirst(initialVehicle.status) : 'Goed',
    });
  }, [initialVehicle, brands, currentYear]);

  useEffect(() => {
    if (!initialVehicle || !form.brand_id || models.length === 0) return;
    const modelId = models.find((m) => m.name === initialVehicle.model)?.id ?? '';
    setForm((prev) => ({ ...prev, model_id: modelId }));
  }, [initialVehicle, initialVehicle?.model, form.brand_id, models]);

  useEffect(() => {
    if (prevStructureIdRef.current === undefined) {
      prevStructureIdRef.current = form.structure_id as string | undefined;
      return;
    }
    if (prevStructureIdRef.current && prevStructureIdRef.current !== form.structure_id) {
      setForm((prev) => ({ ...prev, department_id: '' }));
    }
    prevStructureIdRef.current = form.structure_id as string | undefined;
  }, [form.structure_id]);

  useEffect(() => {
    if (prevBrandIdRef.current === undefined) {
      prevBrandIdRef.current = form.brand_id as string | undefined;
      return;
    }
    if (prevBrandIdRef.current && prevBrandIdRef.current !== form.brand_id) {
      setForm((prev) => ({ ...prev, model_id: '' }));
    }
    prevBrandIdRef.current = form.brand_id as string | undefined;
  }, [form.brand_id]);

  const handleChange = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const brandName = brands.find((b) => b.id === form.brand_id)?.name ?? '';
    const modelName = models.find((m) => m.id === form.model_id)?.name ?? '';
    onSubmit({
      ...form,
      merk: brandName,
      model: modelName,
    });
  };

  return (
    <div className="vehicle-form-overlay">
      <div className="vehicle-form-modal">
        <div className="vehicle-form-header">
          <h2>{isEdit ? 'Voertuig bewerken' : 'Nieuw voertuig registreren'}</h2>
          <button type="button" onClick={onClose} className="vehicle-form-close">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="vehicle-form">
          {error && <div className="vehicle-form-error">{error}</div>}

          <div className="vehicle-form-row">
            <label>
              Inzet <span className="required">*</span>
            </label>
            <select
              value={String(form.inzet)}
              onChange={(e) => handleChange('inzet', e.target.value)}
              required
            >
              <option value="Dienstplaat">Dienstplaat</option>
              <option value="Burgerplaat">Burgerplaat</option>
            </select>
          </div>

          <div className="vehicle-form-row">
            <label>
              Kentekennummer <span className="required">*</span>
            </label>
            <input
              type="text"
              value={String(form.license_plate)}
              onChange={(e) => handleChange('license_plate', e.target.value)}
              placeholder="PA-00-00 of 00-00 AP of 0000-D"
              required
            />
          </div>

          <div className="vehicle-form-row">
            <label>
              Structuur <span className="required">*</span>
            </label>
            <select
              value={String(form.structure_id)}
              onChange={(e) => handleChange('structure_id', e.target.value)}
              required
            >
              <option value="">— Selecteer —</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="vehicle-form-row">
            <label>
              Afdeling <span className="required">*</span>
            </label>
            <select
              value={String(form.department_id)}
              onChange={(e) => handleChange('department_id', e.target.value)}
              disabled={!form.structure_id}
              required
            >
              <option value="">— Selecteer —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="vehicle-form-row">
            <label>
              Merk <span className="required">*</span>
            </label>
            <select
              value={String(form.brand_id)}
              onChange={(e) => handleChange('brand_id', e.target.value)}
              required
            >
              <option value="">— Selecteer —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="vehicle-form-row">
            <label>
              Model <span className="required">*</span>
            </label>
            <select
              value={String(form.model_id)}
              onChange={(e) => handleChange('model_id', e.target.value)}
              disabled={!form.brand_id}
              required
            >
              <option value="">— Selecteer —</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="vehicle-form-row">
            <label>Bouwjaar</label>
            <select
              value={String(form.bouwjaar)}
              onChange={(e) => handleChange('bouwjaar', e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— Selecteer —</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="vehicle-form-row">
            <label>Soort</label>
            <select
              value={String(form.soort)}
              onChange={(e) => handleChange('soort', e.target.value)}
            >
              <option value="">— Selecteer —</option>
              <option value="Sedan">Sedan</option>
              <option value="Pickup">Pickup</option>
              <option value="SUV">SUV</option>
              <option value="Station">Station</option>
              <option value="Bus">Bus</option>
              <option value="Truck">Truck</option>
            </select>
          </div>

          <div className="vehicle-form-row">
            <label>Transmissie</label>
            <select
              value={String(form.transmissie)}
              onChange={(e) => handleChange('transmissie', e.target.value)}
            >
              <option value="">— Selecteer —</option>
              <option value="automaat">Automaat</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          <div className="vehicle-form-row">
            <label>Aandrijving</label>
            <select
              value={String(form.aandrijving)}
              onChange={(e) => handleChange('aandrijving', e.target.value)}
            >
              <option value="">— Selecteer —</option>
              <option value="4WD">4WD</option>
              <option value="2WD">2WD</option>
            </select>
          </div>

          <div className="vehicle-form-row">
            <label>Chassisnummer</label>
            <input
              type="text"
              value={String(form.chassisnummer)}
              onChange={(e) => handleChange('chassisnummer', e.target.value)}
              placeholder="Chassisnummer"
            />
          </div>

          <div className="vehicle-form-row">
            <label>Status</label>
            <select
              value={String(form.status)}
              onChange={(e) => handleChange('status', e.target.value)}
            >
              <option value="Defect">Defect</option>
              <option value="Slecht">Slecht</option>
              <option value="Redelijk">Redelijk</option>
              <option value="Goed">Goed</option>
            </select>
          </div>

          <section className="vehicle-form-section">
            <h3 className="vehicle-form-section-title">Verzekering</h3>
            <div className="vehicle-form-row">
              <label>Verzekerd bij</label>
              <select
                value={String(form.verzekerd)}
                onChange={(e) => handleChange('verzekerd', e.target.value)}
              >
                <option value="">— Selecteer —</option>
                <option value="Self-Reliance">Self-Reliance</option>
                <option value="Assuria">Assuria</option>
                <option value="Parsasco">Parsasco</option>
                <option value="Fatum">Fatum</option>
              </select>
            </div>
            <div className="vehicle-form-row">
              <label>Polisnummer</label>
              <input
                type="text"
                value={String(form.polisnummer)}
                onChange={(e) => handleChange('polisnummer', e.target.value)}
                placeholder="Polisnummer"
              />
            </div>
            <div className="vehicle-form-row">
              <label>Verzekertype</label>
              <select
                value={String(form.verzekertype)}
                onChange={(e) => handleChange('verzekertype', e.target.value)}
              >
                <option value="">— Selecteer —</option>
                <option value="WA">WA</option>
                <option value="Mini Casco">Mini Casco</option>
                <option value="Casco">Casco</option>
              </select>
            </div>
            <div className="vehicle-form-row">
              <label>Verzekering geldig van</label>
              <input
                type="date"
                value={String(form.start_datum)}
                onChange={(e) => handleChange('start_datum', e.target.value)}
              />
            </div>
            <div className="vehicle-form-row">
              <label>Verzekering geldig tot</label>
              <input
                type="date"
                value={String(form.eind_datum)}
                onChange={(e) => handleChange('eind_datum', e.target.value)}
              />
            </div>
          </section>

          <div className="vehicle-form-row vehicle-form-row-full">
            <label>Opmerking</label>
            <textarea
              value={String(form.opmerking)}
              onChange={(e) => handleChange('opmerking', e.target.value)}
              rows={3}
            />
          </div>

          <div className="vehicle-form-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annuleren
            </button>
            <button type="submit" className="btn-primary" disabled={saveLoading}>
              {saveLoading ? 'Bezig...' : isEdit ? 'Opslaan' : 'Registreren'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
