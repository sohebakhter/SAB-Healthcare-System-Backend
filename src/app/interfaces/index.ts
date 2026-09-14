export interface IQuery {
	searchTerm?: string;
	limit?: string;
	page?: string;
	sortBy?: string;
	sortOrder?: string;
	[key: string]: any; // Allow additional query parameters
}
