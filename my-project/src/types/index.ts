export interface AppConfig {
    port: number;
    environment: 'development' | 'production';
}

export interface ComponentProps {
    id: string;
    className?: string;
    children?: string | HTMLElement[];
}