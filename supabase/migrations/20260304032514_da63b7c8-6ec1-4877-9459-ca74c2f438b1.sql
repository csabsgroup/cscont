
-- =============================================
-- FASE 1: Tabelas Base + RBAC + RLS
-- =============================================

-- 1. Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'csm', 'viewer', 'client');

-- 2. Enum de status do cliente
CREATE TYPE public.office_status AS ENUM ('ativo', 'churn', 'nao_renovado', 'nao_iniciado', 'upsell', 'bonus_elite');

-- 3. Enum de status do contrato
CREATE TYPE public.contract_status AS ENUM ('ativo', 'encerrado', 'cancelado', 'pendente');

-- 4. Tabela de produtos
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tabela de perfis (vinculada a auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Tabela de roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 7. Tabela de escritórios
CREATE TABLE public.offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  state TEXT,
  instagram TEXT,
  photo_url TEXT,
  visible_in_directory BOOLEAN NOT NULL DEFAULT true,
  status public.office_status NOT NULL DEFAULT 'nao_iniciado',
  csm_id UUID REFERENCES auth.users(id),
  active_product_id UUID REFERENCES public.products(id),
  onboarding_date DATE,
  activation_date DATE,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Tabela de contatos (sócios)
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role_title TEXT,
  is_main_contact BOOLEAN NOT NULL DEFAULT false,
  birthday DATE,
  instagram TEXT,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Tabela de contratos
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  status public.contract_status NOT NULL DEFAULT 'pendente',
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  value NUMERIC(12,2),
  monthly_value NUMERIC(12,2),
  installments_total INTEGER DEFAULT 0,
  installments_overdue INTEGER DEFAULT 0,
  asaas_link TEXT,
  negotiation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Tabela de vínculo client<->office
CREATE TABLE public.client_office_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, office_id)
);

-- 11. Tabela de vínculo manager<->csm (hierarquia)
CREATE TABLE public.manager_csm_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  csm_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manager_id, csm_id)
);

-- =============================================
-- ENABLE RLS on all tables
-- =============================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_office_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_csm_links ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER helper functions
-- =============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Get office IDs that a CSM manages
CREATE OR REPLACE FUNCTION public.get_csm_office_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.offices WHERE csm_id = _user_id
$$;

-- Get office IDs that a manager can see (through their CSMs)
CREATE OR REPLACE FUNCTION public.get_manager_office_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id FROM public.offices o
  INNER JOIN public.manager_csm_links mcl ON mcl.csm_id = o.csm_id
  WHERE mcl.manager_id = _user_id
$$;

-- Get office IDs for a client user
CREATE OR REPLACE FUNCTION public.get_client_office_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT office_id FROM public.client_office_links WHERE user_id = _user_id
$$;

-- Combined: get all office IDs visible to a user based on role
CREATE OR REPLACE FUNCTION public.get_visible_office_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.offices
  WHERE
    public.has_role(_user_id, 'admin') OR
    public.has_role(_user_id, 'viewer') OR
    (public.has_role(_user_id, 'csm') AND csm_id = _user_id) OR
    (public.has_role(_user_id, 'manager') AND id IN (SELECT public.get_manager_office_ids(_user_id))) OR
    (public.has_role(_user_id, 'client') AND id IN (SELECT public.get_client_office_ids(_user_id)))
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Manager can view profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "CSM can view profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'csm'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admin can update any profile" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Manager can view roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- PRODUCTS (everyone can read, only admin can write)
CREATE POLICY "Authenticated can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- OFFICES
CREATE POLICY "Users see visible offices" ON public.offices FOR SELECT USING (
  id IN (SELECT public.get_visible_office_ids(auth.uid()))
);
CREATE POLICY "Admin can manage offices" ON public.offices FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can update own offices" ON public.offices FOR UPDATE USING (
  public.has_role(auth.uid(), 'csm') AND csm_id = auth.uid()
);
CREATE POLICY "Manager can insert offices" ON public.offices FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Manager can update offices" ON public.offices FOR UPDATE USING (
  public.has_role(auth.uid(), 'manager') AND id IN (SELECT public.get_manager_office_ids(auth.uid()))
);

-- CONTACTS
CREATE POLICY "Users see contacts of visible offices" ON public.contacts FOR SELECT USING (
  office_id IN (SELECT public.get_visible_office_ids(auth.uid()))
);
CREATE POLICY "Admin can manage contacts" ON public.contacts FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can manage contacts" ON public.contacts FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid()))
);
CREATE POLICY "CSM can update contacts" ON public.contacts FOR UPDATE USING (
  public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid()))
);
CREATE POLICY "CSM can delete contacts" ON public.contacts FOR DELETE USING (
  public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid()))
);

-- CONTRACTS
CREATE POLICY "Users see contracts of visible offices" ON public.contracts FOR SELECT USING (
  office_id IN (SELECT public.get_visible_office_ids(auth.uid()))
);
CREATE POLICY "Admin can manage contracts" ON public.contracts FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can manage contracts" ON public.contracts FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid()))
);
CREATE POLICY "CSM can update contracts" ON public.contracts FOR UPDATE USING (
  public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid()))
);

-- CLIENT_OFFICE_LINKS
CREATE POLICY "Users can view own links" ON public.client_office_links FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin can manage links" ON public.client_office_links FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- MANAGER_CSM_LINKS
CREATE POLICY "Manager can view own links" ON public.manager_csm_links FOR SELECT USING (manager_id = auth.uid());
CREATE POLICY "Admin can manage manager links" ON public.manager_csm_links FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can view manager links" ON public.manager_csm_links FOR SELECT USING (csm_id = auth.uid());

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_offices_updated_at BEFORE UPDATE ON public.offices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_offices_csm ON public.offices(csm_id);
CREATE INDEX idx_offices_product ON public.offices(active_product_id);
CREATE INDEX idx_offices_status ON public.offices(status);
CREATE INDEX idx_contacts_office ON public.contacts(office_id);
CREATE INDEX idx_contracts_office ON public.contracts(office_id);
CREATE INDEX idx_contracts_product ON public.contracts(product_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_client_links_user ON public.client_office_links(user_id);
CREATE INDEX idx_client_links_office ON public.client_office_links(office_id);
CREATE INDEX idx_manager_links_manager ON public.manager_csm_links(manager_id);
CREATE INDEX idx_manager_links_csm ON public.manager_csm_links(csm_id);
