import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2,
  Users,
  Check,
  X,
  History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Input } from '../components/common/UIComponents';
import Modal from '../components/common/Modal';
import { 
  rolesPermissionsService, 
  Role, 
  UserRole, 
  Permission,
  PermissionAction,
  SYSTEM_ROLES 
} from '../services/rolesPermissionsService';
import { employeeService, Employee } from '../services/employeeService';

const MODULES = ['HR', 'Attendance', 'Payroll', 'Recruitment', 'Analytics', 'Settings'];
const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'approve', 'delete', 'export'];

export default function RolesPermissionsPage() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roles' | 'assignments' | 'audit'>('roles');
  
  // Role Modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[]
  });

  // Assignment Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesData, userRolesData, employeesData] = await Promise.all([
        rolesPermissionsService.getAllRoles(),
        rolesPermissionsService.getUserRoles(),
        employeeService.getAll()
      ]);
      setRoles(rolesData);
      setUserRoles(userRolesData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await rolesPermissionsService.createRole({
        ...newRole,
        is_system_role: false
      });
      await rolesPermissionsService.logAudit(
        'CREATE',
        'role',
        newRole.name,
        newRole,
        'Current User'
      );
      await loadData();
      setIsRoleModalOpen(false);
      setNewRole({ name: '', description: '', permissions: [] });
    } catch (error) {
      console.error('Failed to create role:', error);
      alert('Failed to create role. Please check console.');
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    try {
      await rolesPermissionsService.updateRole(editingRole.id, {
        name: newRole.name,
        description: newRole.description,
        permissions: newRole.permissions
      });
      await rolesPermissionsService.logAudit(
        'UPDATE',
        'role',
        editingRole.id,
        { old: editingRole, new: newRole },
        'Current User'
      );
      await loadData();
      setIsRoleModalOpen(false);
      setEditingRole(null);
      setNewRole({ name: '', description: '', permissions: [] });
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update role. Please check console.');
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"?`)) return;

    try {
      await rolesPermissionsService.deleteRole(roleId);
      await rolesPermissionsService.logAudit(
        'DELETE',
        'role',
        roleId,
        { name: roleName },
        'Current User'
      );
      await loadData();
    } catch (error) {
      console.error('Failed to delete role:', error);
      alert('Failed to delete role. Please check console.');
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedRoleId) return;

    try {
      await rolesPermissionsService.assignRole(
        selectedUserId,
        selectedRoleId,
        'Current User',
        effectiveDate
      );
      await rolesPermissionsService.logAudit(
        'ASSIGN',
        'user_role',
        selectedUserId,
        { role_id: selectedRoleId, effective_date: effectiveDate },
        'Current User'
      );
      await loadData();
      setIsAssignModalOpen(false);
      setSelectedUserId('');
      setSelectedRoleId('');
    } catch (error) {
      console.error('Failed to assign role:', error);
      alert('Failed to assign role. Please check console.');
    }
  };

  const handleRemoveUserRole = async (userRoleId: string, userName: string) => {
    if (!confirm(`Remove role assignment for ${userName}?`)) return;

    try {
      await rolesPermissionsService.removeUserRole(userRoleId);
      await rolesPermissionsService.logAudit(
        'REMOVE',
        'user_role',
        userRoleId,
        {},
        'Current User'
      );
      await loadData();
    } catch (error) {
      console.error('Failed to remove user role:', error);
    }
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setNewRole({
      name: role.name,
      description: role.description,
      permissions: typeof role.permissions === 'string' 
        ? JSON.parse(role.permissions) 
        : role.permissions
    });
    setIsRoleModalOpen(true);
  };

  const togglePermission = (module: string, action: PermissionAction) => {
    const moduleIndex = newRole.permissions.findIndex(p => p.module === module);
    
    if (moduleIndex === -1) {
      // Module doesn't exist, add it with this action
      setNewRole({
        ...newRole,
        permissions: [...newRole.permissions, { module, actions: [action] }]
      });
    } else {
      // Module exists, toggle the action
      const modulePermission = newRole.permissions[moduleIndex];
      const actionIndex = modulePermission.actions.indexOf(action);
      
      if (actionIndex === -1) {
        // Add action
        const updatedPermissions = [...newRole.permissions];
        updatedPermissions[moduleIndex] = {
          ...modulePermission,
          actions: [...modulePermission.actions, action]
        };
        setNewRole({ ...newRole, permissions: updatedPermissions });
      } else {
        // Remove action
        const updatedPermissions = [...newRole.permissions];
        const updatedActions = modulePermission.actions.filter(a => a !== action);
        
        if (updatedActions.length === 0) {
          // Remove module if no actions left
          updatedPermissions.splice(moduleIndex, 1);
        } else {
          updatedPermissions[moduleIndex] = {
            ...modulePermission,
            actions: updatedActions
          };
        }
        setNewRole({ ...newRole, permissions: updatedPermissions });
      }
    }
  };

  const hasPermission = (module: string, action: PermissionAction): boolean => {
    const modulePermission = newRole.permissions.find(p => p.module === module);
    return modulePermission ? modulePermission.actions.includes(action) : false;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading tracking-tight text-foreground">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-1">Manage system roles and user access control.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'roles' && (
            <Button variant="primary" onClick={() => setIsRoleModalOpen(true)}>
              <Plus size={18} className="mr-2 rtl:ml-2 rtl:mr-0" />
              New Role
            </Button>
          )}
          {activeTab === 'assignments' && (
            <Button variant="primary" onClick={() => setIsAssignModalOpen(true)}>
              <Plus size={18} className="mr-2 rtl:ml-2 rtl:mr-0" />
              Assign Role
            </Button>
          )}
        </div>
      </div>

      {/* Role Modal */}
      <Modal 
        isOpen={isRoleModalOpen} 
        onClose={() => {
          setIsRoleModalOpen(false);
          setEditingRole(null);
          setNewRole({ name: '', description: '', permissions: [] });
        }} 
        title={editingRole ? 'Edit Role' : 'Create New Role'}
      >
        <form onSubmit={editingRole ? handleUpdateRole : handleCreateRole} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Role Name</label>
            <Input 
              required
              value={newRole.name}
              onChange={e => setNewRole({...newRole, name: e.target.value})}
              placeholder="e.g., Custom Manager" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input 
              value={newRole.description}
              onChange={e => setNewRole({...newRole, description: e.target.value})}
              placeholder="Brief description of this role" 
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Permissions</label>
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-3 py-2 text-left">Module</th>
                    {ACTIONS.map(action => (
                      <th key={action} className="px-2 py-2 text-center capitalize">{action}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(module => (
                    <tr key={module} className="border-t border-white/5">
                      <td className="px-3 py-2 font-medium">{module}</td>
                      {ACTIONS.map(action => (
                        <td key={action} className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => togglePermission(module, action)}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                              hasPermission(module, action)
                                ? 'bg-primary text-white'
                                : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            {hasPermission(module, action) && <Check size={14} />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsRoleModalOpen(false);
                setEditingRole(null);
                setNewRole({ name: '', description: '', permissions: [] });
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      {/* Assignment Modal */}
      <Modal 
        isOpen={isAssignModalOpen} 
        onClose={() => setIsAssignModalOpen(false)} 
        title="Assign Role to User"
      >
        <form onSubmit={handleAssignRole} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select User</label>
            <select 
              className="w-full h-10 bg-white/5 border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-primary"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              required
            >
              <option value="">Choose a user...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Select Role</label>
            <select 
              className="w-full h-10 bg-white/5 border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-primary"
              value={selectedRoleId}
              onChange={e => setSelectedRoleId(e.target.value)}
              required
            >
              <option value="">Choose a role...</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Effective Date</label>
            <Input 
              type="date"
              value={effectiveDate}
              onChange={e => setEffectiveDate(e.target.value)}
              required
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">Assign</Button>
          </div>
        </form>
      </Modal>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'roles'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield size={16} className="inline mr-2" />
          Roles
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'assignments'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users size={16} className="inline mr-2" />
          Assignments
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'audit'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <History size={16} className="inline mr-2" />
          Audit Log
        </button>
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <Card>
          <CardHeader>
            <CardTitle>System Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading roles...</div>
              ) : roles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No roles found. Create one to get started.</div>
              ) : (
                roles.map(role => {
                  const permissions = typeof role.permissions === 'string' 
                    ? JSON.parse(role.permissions) 
                    : role.permissions;
                  
                  return (
                    <div key={role.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">{role.name}</h3>
                            {role.is_system_role && (
                              <Badge variant="outline">System</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                        </div>
                        {!role.is_system_role && (
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openEditModal(role)}
                            >
                              <Edit size={16} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteRole(role.id, role.name)}
                            >
                              <Trash2 size={16} className="text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {permissions.map((perm: Permission) => (
                          <Badge key={perm.module} variant="default">
                            {perm.module}: {perm.actions.join(', ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <Card>
          <CardHeader>
            <CardTitle>User Role Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left rtl:text-right">
                <thead className="text-xs text-muted-foreground uppercase bg-white/5">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg rtl:rounded-r-lg rtl:rounded-l-none">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Effective Date</th>
                    <th className="px-4 py-3">Assigned By</th>
                    <th className="px-4 py-3 rounded-r-lg rtl:rounded-l-lg rtl:rounded-r-none">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading assignments...</td></tr>
                  ) : userRoles.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No role assignments found.</td></tr>
                  ) : userRoles.map(userRole => (
                    <tr key={userRole.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {userRole.users ? 
                          `${userRole.users.first_name} ${userRole.users.last_name}` : 
                          userRole.user_id
                        }
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default">
                          {userRole.roles?.name || userRole.role_id}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {userRole.effective_date ? 
                          new Date(userRole.effective_date).toLocaleDateString() : 
                          'Immediate'
                        }
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {userRole.assigned_by}
                      </td>
                      <td className="px-4 py-3">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleRemoveUserRole(
                            userRole.id, 
                            userRole.users ? `${userRole.users.first_name} ${userRole.users.last_name}` : 'User'
                          )}
                        >
                          <X size={16} className="text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <Card>
          <CardHeader>
            <CardTitle>Permission Change Audit Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Audit log functionality will be displayed here.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
